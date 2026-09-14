<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Audit D4/P3-06: users.avg_score was written on every session finish but
 * never actually shown to the learner - DashboardPage's own comment
 * documents it was removed from the UI after auditing its source
 * (SessionController's "simulated scoring", not a real linguistic
 * measure). Dead weight in the API/DB since nothing reads it anymore.
 * Not to be confused with AdminStatsController's unrelated avgScoreGlobal
 * (a live SQL AVG over all sessions, still used in the admin dashboard).
 */
final class Version20260914100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Audit D4: drop users.avg_score (unused, per-user simulated score never shown)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE users DROP COLUMN avg_score');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE users ADD COLUMN avg_score NUMERIC(5, 2) CHECK (avg_score BETWEEN 0 AND 100)');
    }
}
