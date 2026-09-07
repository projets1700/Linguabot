<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Avatar choice (male/female) made at registration, kept on both users and
 * pending_registrations (the account doesn't exist yet during email
 * verification - see PendingRegistration). DEFAULT 'male' backfills any row
 * that predates this column, on both tables. Not part of the original
 * Jalon 3 MPD.
 */
final class Version20260907120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Avatar choice: avatar_type enum + column on users and pending_registrations';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("CREATE TYPE avatar_type AS ENUM ('male', 'female')");
        $this->addSql("ALTER TABLE users ADD COLUMN avatar_type avatar_type NOT NULL DEFAULT 'male'");
        $this->addSql("ALTER TABLE pending_registrations ADD COLUMN avatar_type avatar_type NOT NULL DEFAULT 'male'");
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE pending_registrations DROP COLUMN avatar_type');
        $this->addSql('ALTER TABLE users DROP COLUMN avatar_type');
        $this->addSql('DROP TYPE avatar_type');
    }
}
