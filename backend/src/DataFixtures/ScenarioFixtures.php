<?php

namespace App\DataFixtures;

use App\Entity\Level;
use App\Entity\Scenario;
use App\Enum\ScenarioCategory;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * The 40 MVP scenarios (5 quotidien + 5 thematique per level, A1 -> B2)
 * exactly as catalogued in the CDCF (section 3.5).
 */
final class ScenarioFixtures extends Fixture implements DependentFixtureInterface
{
    private const BASE_XP_BY_LEVEL = [
        'A1' => 60,
        'A2' => 100,
        'B1' => 150,
        'B2' => 200,
    ];

    /**
     * [code, title, levelCode, category, objective, characterName].
     */
    private const SCENARIOS = [
        // Niveau A1
        ['QA1-1', 'Se présenter et saluer', 'A1', 'quotidien', "Rencontrer quelqu'un pour la première fois", 'Passant / Voisin'],
        ['QA1-2', 'Commander au café', 'A1', 'quotidien', "Demander un café, un jus, l'addition", 'Serveur / Barista'],
        ['QA1-3', 'Faire ses courses (épicerie)', 'A1', 'quotidien', 'Demander un produit, comprendre le prix', 'Vendeur / Caissière'],
        ['QA1-4', 'Prendre le bus ou le métro', 'A1', 'quotidien', 'Demander un billet, valider, descendre', 'Chauffeur / Agent'],
        ['QA1-5', "Demander l'heure et une direction simple", 'A1', 'quotidien', "Où est la gare ? C'est loin ?", 'Passant'],
        ['TA1-1', "Voyage : arriver à l'aéroport", 'A1', 'thematique', 'Check-in, déposer ses bagages', "Agent d'enregistrement"],
        ['TA1-2', 'Hôtel : check-in basique', 'A1', 'thematique', 'Donner son nom, recevoir sa clé', 'Réceptionniste'],
        ['TA1-3', 'Travail : se présenter à ses collègues', 'A1', 'thematique', 'Prénom, poste, nationalité', 'Collègue'],
        ['TA1-4', 'Santé : décrire un symptôme simple', 'A1', 'thematique', "J'ai mal à la tête, j'ai de la fièvre", 'Infirmier / Médecin'],
        ['TA1-5', 'Loisirs : réserver une place de cinéma', 'A1', 'thematique', 'Choisir un film, une heure, payer', 'Caissier cinéma'],

        // Niveau A2
        ['QA2-1', 'Au restaurant : commander un repas complet', 'A2', 'quotidien', 'Entrée, plat, dessert, allergies', 'Serveur'],
        ['QA2-2', 'Chez le médecin : consultation simple', 'A2', 'quotidien', "Décrire ses symptômes, comprendre l'ordonnance", 'Médecin'],
        ['QA2-3', 'À la poste / banque', 'A2', 'quotidien', 'Envoyer un colis, ouvrir un compte', 'Agent poste / Banquier'],
        ['QA2-4', 'Faire réparer quelque chose', 'A2', 'quotidien', 'Expliquer une panne, négocier le prix', 'Technicien / Réparateur'],
        ['QA2-5', 'Inviter quelqu\'un et organiser une sortie', 'A2', 'quotidien', 'Proposer, accepter, refuser poliment', 'Ami / Collègue'],
        ['TA2-1', 'Voyage : louer une voiture', 'A2', 'thematique', 'Choisir un véhicule, signer les papiers', 'Agent location'],
        ['TA2-2', 'Hôtel : réclamation et demande de service', 'A2', 'thematique', 'Chambre bruyante, room service, extension', 'Réceptionniste'],
        ['TA2-3', "Travail : réunion d'équipe simple", 'A2', 'thematique', 'Donner son avis, poser des questions', "Chef d'équipe"],
        ['TA2-4', 'Santé : pharmacie', 'A2', 'thematique', 'Expliquer une ordonnance, acheter sans ordonnance', 'Pharmacien'],
        ['TA2-5', 'Loisirs : visiter un musée / monument', 'A2', 'thematique', 'Acheter un ticket, demander des infos', 'Guide / Guichetier'],

        // Niveau B1
        ['QB1-1', 'Négocier un achat ou un prix', 'B1', 'quotidien', 'Marchander, comparer, argumenter', 'Vendeur / Artisan'],
        ['QB1-2', 'Résoudre un problème de livraison', 'B1', 'quotidien', 'Colis perdu, retard, remboursement', 'Service client'],
        ['QB1-3', 'Faire une réclamation formelle', 'B1', 'quotidien', 'Produit défectueux, lettre de plainte orale', 'Service après-vente'],
        ['QB1-4', 'Parler de son parcours et ses projets', 'B1', 'quotidien', 'Études, expériences, ambitions', 'Conseiller orientation'],
        ['QB1-5', "Appeler les secours / urgence", 'B1', 'quotidien', "Décrire un accident, une adresse, l'état d'une victime", 'Opérateur 112'],
        ['TB1-1', 'Voyage : problème de billet / train annulé', 'B1', 'thematique', 'Réclamer, obtenir un remboursement, trouver une alternative', 'Agent SNCF / Compagnie'],
        ['TB1-2', "Travail : entretien d'embauche", 'B1', 'thematique', 'Se présenter, parler de son expérience, répondre aux questions RH', 'Recruteur'],
        ['TB1-3', 'Santé : hospitalisation courte', 'B1', 'thematique', 'Admission, antécédents, consentement éclairé', 'Médecin / Infirmier'],
        ['TB1-4', 'Logement : chercher un appartement', 'B1', 'thematique', 'Décrire ses besoins, comprendre le bail, négocier', 'Agent immobilier'],
        ['TB1-5', 'Loisirs : activité sportive / cours', 'B1', 'thematique', "S'inscrire, connaître les règles, interagir avec le coach", 'Coach / Moniteur'],

        // Niveau B2
        ['QB2-1', 'Débat sur un sujet de société', 'B2', 'quotidien', 'Défendre un point de vue, nuancer, contre-argumenter', 'Interlocuteur / Journaliste'],
        ['QB2-2', 'Gérer un conflit de voisinage', 'B2', 'quotidien', 'Expliquer, écouter, trouver un compromis', 'Voisin / Syndic'],
        ['QB2-3', 'Entretien avec un avocat ou notaire', 'B2', 'quotidien', 'Comprendre des termes juridiques, poser des questions précises', 'Avocat / Notaire'],
        ['QB2-4', 'Rendez-vous bancaire : prêt / investissement', 'B2', 'quotidien', 'Comparer des offres, comprendre les conditions', 'Conseiller banque'],
        ['QB2-5', 'Réunion de copropriété', 'B2', 'quotidien', 'Prendre la parole, voter, défendre un projet', 'Syndic / Copropriétaires'],
        ['TB2-1', 'Voyage : incident diplomatique / perte de passeport', 'B2', 'thematique', "Contacter l'ambassade, gérer l'urgence administrative", 'Agent consulaire'],
        ['TB2-2', 'Travail : présentation projet à un client international', 'B2', 'thematique', 'Pitcher, répondre aux objections, conclure', 'Client / Investisseur'],
        ['TB2-3', 'Travail : négociation salariale', 'B2', 'thematique', 'Argumenter sa valeur, comprendre le package, conclure', 'DRH / Manager'],
        ['TB2-4', "Santé : annonce d'un diagnostic", 'B2', 'thematique', 'Comprendre une pathologie, poser des questions médicales précises', 'Médecin spécialiste'],
        ['TB2-5', 'Loisirs : conférence ou débat public', 'B2', 'thematique', 'Participer à un panel, reformuler, synthétiser', 'Modérateur / Panel'],
    ];

    public function load(ObjectManager $manager): void
    {
        foreach (self::SCENARIOS as [$code, $title, $levelCode, $category, $objective, $characterName]) {
            /** @var Level $level */
            $level = $this->getReference(LevelFixtures::reference($levelCode), Level::class);

            $scenario = (new Scenario())
                ->setCode($code)
                ->setTitle($title)
                ->setContext($objective)
                ->setLevel($level)
                ->setCategory(ScenarioCategory::from($category))
                ->setPromptTemplate(\sprintf(
                    "You are %s, a character in an English conversation practice scenario titled '%s'. ".
                    "The learner is at CECRL level %s. Conversation objective: %s. ".
                    'Stay in character, speak only English, adapt your vocabulary and pace to the level, '.
                    'and gently correct the learner when needed.',
                    $characterName,
                    $title,
                    $levelCode,
                    $objective,
                ))
                ->setCharacterName($characterName)
                ->setDurationEstimate(10)
                ->setBaseXp(self::BASE_XP_BY_LEVEL[$levelCode]);

            $manager->persist($scenario);
        }

        $manager->flush();
    }

    public function getDependencies(): array
    {
        return [LevelFixtures::class];
    }
}
