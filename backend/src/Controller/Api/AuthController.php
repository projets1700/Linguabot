<?php

namespace App\Controller\Api;

use App\DTO\RegisterDTO;
use App\DTO\VerifyEmailDTO;
use App\Entity\PendingRegistration;
use App\Entity\User;
use App\Enum\AvatarType;
use App\Enum\UserRole;
use App\Repository\LevelRepository;
use App\Repository\PendingRegistrationRepository;
use App\Repository\UserRepository;
use App\Service\RegistrationMailer;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;

final class AuthController
{
    /**
     * Never actually executed: the `login` firewall's json_login authenticator
     * intercepts POST /api/auth/login before the controller resolves. The
     * route only needs to exist so Symfony's router doesn't 404 first.
     */
    #[Route('/api/auth/login', name: 'api_auth_login', methods: ['POST'])]
    public function login(): never
    {
        throw new \LogicException('This should never be reached: intercepted by the "login" firewall.');
    }

    /**
     * Does not create a User: stores the submitted data in pending_registrations
     * and emails a verification link. The account only exists once that link
     * is opened (see verifyEmail()). Registering again with the same email
     * before verifying just refreshes the pending row and resends the email.
     */
    #[Route('/api/auth/register', name: 'api_auth_register', methods: ['POST'])]
    public function register(
        Request $request,
        SerializerInterface $serializer,
        ValidatorInterface $validator,
        UserRepository $userRepository,
        PendingRegistrationRepository $pendingRepository,
        UserPasswordHasherInterface $passwordHasher,
        RegistrationMailer $registrationMailer,
    ): JsonResponse {
        try {
            $dto = $serializer->deserialize($request->getContent(), RegisterDTO::class, 'json');
        } catch (\Throwable) {
            return new JsonResponse(['message' => 'Corps de requête JSON invalide.'], 400);
        }

        $violations = $validator->validate($dto);
        if (\count($violations) > 0) {
            $errors = [];
            foreach ($violations as $violation) {
                $errors[$violation->getPropertyPath()] = $violation->getMessage();
            }

            return new JsonResponse(['message' => 'Données invalides.', 'errors' => $errors], 422);
        }

        if (null !== $userRepository->findByEmail($dto->email)) {
            return new JsonResponse(['message' => 'Cet email est déjà utilisé.'], 422);
        }

        // A throwaway User is only needed here to satisfy the hasher's
        // PasswordAuthenticatedUserInterface signature - nothing about it is
        // persisted, only the resulting hash string is kept.
        $passwordHash = $passwordHasher->hashPassword(new User(), $dto->password);

        $pending = $pendingRepository->findByEmail($dto->email) ?? new PendingRegistration();
        $pending
            ->setEmail($dto->email)
            ->setPrenom($dto->prenom)
            ->setNom($dto->nom)
            ->setPasswordHash($passwordHash)
            ->setAvatarType(AvatarType::from($dto->avatarType))
            ->refreshToken();

        $em = $pendingRepository->getEntityManager();
        $em->persist($pending);
        $em->flush();

        $registrationMailer->sendVerificationEmail($pending);

        return new JsonResponse([
            'message' => 'Vérifie ta boîte mail pour activer ton compte.',
        ], 202);
    }

    /**
     * Consumes the token from the verification email: creates the real User
     * (at level A0) from the pending row's data and deletes that row.
     */
    #[Route('/api/auth/verify-email', name: 'api_auth_verify_email', methods: ['POST'])]
    public function verifyEmail(
        Request $request,
        SerializerInterface $serializer,
        ValidatorInterface $validator,
        PendingRegistrationRepository $pendingRepository,
        UserRepository $userRepository,
        LevelRepository $levelRepository,
        JWTTokenManagerInterface $jwtManager,
    ): JsonResponse {
        try {
            $dto = $serializer->deserialize($request->getContent(), VerifyEmailDTO::class, 'json');
        } catch (\Throwable) {
            return new JsonResponse(['message' => 'Corps de requête JSON invalide.'], 400);
        }

        $violations = $validator->validate($dto);
        if (\count($violations) > 0) {
            return new JsonResponse(['message' => 'Jeton manquant.'], 422);
        }

        $pending = $pendingRepository->findByToken($dto->token);
        if (null === $pending) {
            return new JsonResponse(['message' => 'Lien de vérification invalide.'], 404);
        }

        $em = $pendingRepository->getEntityManager();

        if ($pending->isExpired()) {
            $em->remove($pending);
            $em->flush();

            return new JsonResponse(['message' => 'Ce lien a expiré, merci de vous réinscrire.'], 410);
        }

        if (null !== $userRepository->findByEmail($pending->getEmail())) {
            // Already verified from another tab/click: clean up and stop here.
            $em->remove($pending);
            $em->flush();

            return new JsonResponse(['message' => 'Ce compte est déjà activé, connecte-toi.'], 422);
        }

        $levelA0 = $levelRepository->findOneBy(['code' => 'A0']);
        if (null === $levelA0) {
            return new JsonResponse(['message' => 'Niveau A0 introuvable, veuillez charger les fixtures.'], 500);
        }

        $user = (new User())
            ->setPrenom($pending->getPrenom())
            ->setNom($pending->getNom())
            ->setEmail($pending->getEmail())
            ->setRole(UserRole::USER)
            ->setLevel($levelA0)
            ->setAvatarType($pending->getAvatarType());
        $user->setPasswordHash($pending->getPasswordHash());

        $em->persist($user);
        $em->remove($pending);
        $em->flush();

        return new JsonResponse([
            'message' => 'Compte activé',
            'token' => $jwtManager->create($user),
        ], 201);
    }
}
