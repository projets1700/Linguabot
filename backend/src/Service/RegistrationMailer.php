<?php

namespace App\Service;

use App\Entity\PendingRegistration;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;

final class RegistrationMailer
{
    public function __construct(
        private readonly MailerInterface $mailer,
        private readonly string $frontendUrl,
    ) {
    }

    public function sendVerificationEmail(PendingRegistration $pending): void
    {
        $link = \sprintf('%s/verify-email?token=%s', rtrim($this->frontendUrl, '/'), $pending->getToken());
        $prenom = htmlspecialchars($pending->getPrenom(), ENT_QUOTES);

        $email = (new Email())
            ->from('no-reply@linguabot.fr')
            ->to($pending->getEmail())
            ->subject('Confirme ton inscription à LinguaBot')
            ->html(\sprintf(
                '<p>Bonjour %s,</p>'.
                '<p>Clique sur le lien ci-dessous pour activer ton compte LinguaBot (valable 1 heure) :</p>'.
                '<p><a href="%s">%s</a></p>',
                $prenom,
                $link,
                $link,
            ))
            ->text(\sprintf(
                "Bonjour %s,\n\nActive ton compte LinguaBot en ouvrant ce lien (valable 1 heure) :\n%s",
                $pending->getPrenom(),
                $link,
            ));

        $this->mailer->send($email);
    }
}
