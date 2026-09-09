<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Persists the qualitative end-of-session bilan (SessionSummaryService), so
 * a learner who refreshes or revisits a completed session still sees it -
 * previously it only ever existed in the one HTTP response from finish().
 * Nullable: null until the session is finished, and never set at all for
 * older completed sessions that predate this column.
 */
final class Version20260909130000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add sessions.summary_data (JSONB) to persist the qualitative end-of-session bilan';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE sessions ADD COLUMN summary_data JSONB DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE sessions DROP COLUMN summary_data');
    }
}
