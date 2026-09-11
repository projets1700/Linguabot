<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * V1.1 LOT 4 (§7.5): composite indexes for GET /api/me/stats, whose queries
 * always filter by user_id + a date range - sessions/quiz_attempts each had
 * their user_id and date columns indexed separately, but not together.
 */
final class Version20260911090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Composite (user_id, date) indexes on sessions and quiz_attempts for per-learner stats queries';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE INDEX idx_sessions_user_started ON sessions(user_id, started_at DESC)');
        $this->addSql('CREATE INDEX idx_quiz_attempts_user_attempted ON quiz_attempts(user_id, attempted_at DESC)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX idx_sessions_user_started');
        $this->addSql('DROP INDEX idx_quiz_attempts_user_attempted');
    }
}
