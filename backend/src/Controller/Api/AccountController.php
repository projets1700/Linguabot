<?php

namespace App\Controller\Api;

use App\Entity\User;
use App\Repository\ChallengeSessionRepository;
use App\Repository\PlacementTestRepository;
use App\Repository\QuizAttemptRepository;
use App\Repository\SessionRepository;
use App\Repository\UserBadgeRepository;
use App\Repository\UserTrophyRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

/**
 * Self-service RGPD endpoints for the learner's own account - MeController
 * stays GET-only, these are kept separate so that working, already-tested
 * route is never touched.
 */
final class AccountController
{
    /**
     * Same soft-delete pattern as AdminUserController::delete (RG12), but
     * gated on the learner re-entering their password - without this, a
     * leaked/stolen JWT alone would be enough to delete the account.
     */
    #[Route('/api/me', name: 'api_account_delete', methods: ['DELETE'])]
    public function delete(
        #[CurrentUser] User $user,
        Request $request,
        UserPasswordHasherInterface $passwordHasher,
        EntityManagerInterface $em,
    ): JsonResponse {
        $data = json_decode($request->getContent(), true) ?? [];
        $password = \is_string($data['password'] ?? null) ? $data['password'] : '';

        if ('' === $password || !$passwordHasher->isPasswordValid($user, $password)) {
            return new JsonResponse(['message' => 'Mot de passe incorrect.'], 422);
        }

        $user->setIsActive(false);
        $user->setDeletedAt(new \DateTimeImmutable());
        $em->flush();

        return new JsonResponse(['message' => 'Compte supprimé.']);
    }

    /**
     * Everything RGPD-relevant tied to this learner, as a single downloadable
     * JSON file - profile plus every activity record scoped to their own
     * `user` relation (Doctrine's default findBy, no custom repository
     * methods needed since every one of these entities already has one).
     */
    #[Route('/api/me/export', name: 'api_account_export', methods: ['GET'])]
    public function export(
        #[CurrentUser] User $user,
        SessionRepository $sessionRepository,
        QuizAttemptRepository $quizAttemptRepository,
        ChallengeSessionRepository $challengeSessionRepository,
        PlacementTestRepository $placementTestRepository,
        UserBadgeRepository $userBadgeRepository,
        UserTrophyRepository $userTrophyRepository,
    ): JsonResponse {
        $placementTest = $placementTestRepository->findOneByUser($user);

        $data = [
            'profile' => [
                'id' => $user->getId(),
                'prenom' => $user->getPrenom(),
                'nom' => $user->getNom(),
                'email' => $user->getEmail(),
                'avatarType' => $user->getAvatarType()->value,
                'level' => $user->getLevel()->getCode(),
                'totalXp' => $user->getTotalXp(),
                'sessionsCount' => $user->getSessionsCount(),
                'createdAt' => $user->getCreatedAt()->format(\DateTimeInterface::ATOM),
            ],
            'placementTest' => null !== $placementTest ? [
                'status' => $placementTest->getStatus()->value,
                'resultLevel' => $placementTest->getResultLevel()?->getCode(),
                'startedAt' => $placementTest->getStartedAt()->format(\DateTimeInterface::ATOM),
                'endedAt' => $placementTest->getEndedAt()?->format(\DateTimeInterface::ATOM),
            ] : null,
            'sessions' => array_map(static fn ($s) => [
                'scenario' => $s->getScenario()->getTitle(),
                'status' => $s->getStatus()->value,
                'score' => $s->getScore(),
                'xpEarned' => $s->getXpEarned(),
                'startedAt' => $s->getStartedAt()->format(\DateTimeInterface::ATOM),
                'endedAt' => $s->getEndedAt()?->format(\DateTimeInterface::ATOM),
            ], $sessionRepository->findBy(['user' => $user])),
            'quizAttempts' => array_map(static fn ($a) => [
                'module' => $a->getModule()->getCode(),
                'score' => $a->getScore(),
                'passed' => $a->isPassed(),
                'xpEarned' => $a->getXpEarned(),
                'attemptedAt' => $a->getAttemptedAt()->format(\DateTimeInterface::ATOM),
            ], $quizAttemptRepository->findBy(['user' => $user])),
            'dailyChallenges' => array_map(static fn ($c) => [
                'challenge' => $c->getChallenge()->getTitle(),
                'xpEarned' => $c->getXpEarned(),
                'completedAt' => $c->getCompletedAt()?->format(\DateTimeInterface::ATOM),
            ], $challengeSessionRepository->findBy(['user' => $user])),
            'badges' => array_map(static fn ($b) => [
                'badge' => $b->getBadge()->getName(),
                'earnedAt' => $b->getEarnedAt()->format(\DateTimeInterface::ATOM),
            ], $userBadgeRepository->findBy(['user' => $user])),
            'trophies' => array_map(static fn ($t) => [
                'trophy' => $t->getTrophy()->getName(),
                'earnedAt' => $t->getEarnedAt()?->format(\DateTimeInterface::ATOM),
            ], $userTrophyRepository->findBy(['user' => $user])),
        ];

        $response = new JsonResponse($data);
        $response->headers->set('Content-Disposition', 'attachment; filename="linguabot-mes-donnees.json"');

        return $response;
    }
}
