<?php

namespace App\Controller\Api;

use App\DTO\RegisterDTO;
use App\Entity\User;
use App\Enum\UserRole;
use App\Repository\LevelRepository;
use App\Repository\UserRepository;
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

    #[Route('/api/auth/register', name: 'api_auth_register', methods: ['POST'])]
    public function register(
        Request $request,
        SerializerInterface $serializer,
        ValidatorInterface $validator,
        UserRepository $userRepository,
        LevelRepository $levelRepository,
        UserPasswordHasherInterface $passwordHasher,
        JWTTokenManagerInterface $jwtManager,
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

        $levelA0 = $levelRepository->findOneBy(['code' => 'A0']);
        if (null === $levelA0) {
            return new JsonResponse(['message' => 'Niveau A0 introuvable, veuillez charger les fixtures.'], 500);
        }

        $user = (new User())
            ->setPrenom($dto->prenom)
            ->setNom($dto->nom)
            ->setEmail($dto->email)
            ->setRole(UserRole::USER)
            ->setLevel($levelA0);
        $user->setPasswordHash($passwordHasher->hashPassword($user, $dto->password));

        $userRepository->getEntityManager()->persist($user);
        $userRepository->getEntityManager()->flush();

        return new JsonResponse([
            'message' => 'Compte créé',
            'token' => $jwtManager->create($user),
        ], 201);
    }
}
