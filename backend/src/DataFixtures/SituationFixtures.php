<?php

namespace App\DataFixtures;

use App\Entity\Room;
use App\Entity\Situation;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * 2 situations per room across Monde 1 (14, over 7 rooms), Monde 2 (18,
 * over 9 rooms), Monde 3 (20, over 10 rooms), Monde 4 (10, over 5 rooms),
 * Monde 5 (14, over 7 rooms), Monde 6 (14, over 7 rooms), Monde 7 (8, over 4
 * rooms) and Monde 8 (2, over 1 room) - each room's first situation is the
 * "situation de départ" from LinguaBot_V2_Conception.md §5's tables, the
 * second is an original variant in the same spirit (§6: a room should host
 * more than one situation).
 *
 * Update-in-place by code rather than blind insert - see WorldFixtures.
 */
final class SituationFixtures extends Fixture implements DependentFixtureInterface
{
    public const SITUATION_RAINY_DAY_REFERENCE = 'situation-w1-r1-s1';
    public const SITUATION_DINNER_REFERENCE = 'situation-w1-r1-s2';
    public const SITUATION_RECIPE_REFERENCE = 'situation-w1-r2-s1';
    public const SITUATION_MISSING_INGREDIENT_REFERENCE = 'situation-w1-r2-s2';
    public const SITUATION_PACK_SUITCASE_REFERENCE = 'situation-w1-r3-s1';
    public const SITUATION_FIND_OUTFIT_REFERENCE = 'situation-w1-r3-s2';
    public const SITUATION_GROCERY_SHOPPING_REFERENCE = 'situation-w1-r4-s1';
    public const SITUATION_CHECKOUT_PROBLEM_REFERENCE = 'situation-w1-r4-s2';
    public const SITUATION_BUY_BREAKFAST_REFERENCE = 'situation-w1-r5-s1';
    public const SITUATION_SPECIAL_ORDER_REFERENCE = 'situation-w1-r5-s2';
    public const SITUATION_BUY_CLOTHES_REFERENCE = 'situation-w1-r6-s1';
    public const SITUATION_FITTING_ROOM_REFERENCE = 'situation-w1-r6-s2';
    public const SITUATION_DESCRIBE_HAIRCUT_REFERENCE = 'situation-w1-r7-s1';
    public const SITUATION_BOOK_APPOINTMENT_REFERENCE = 'situation-w1-r7-s2';

    // Monde 2 - Sorties & loisirs
    public const SITUATION_ORDER_COFFEE_REFERENCE = 'situation-w2-r1-s1';
    public const SITUATION_WRONG_ORDER_REFERENCE = 'situation-w2-r1-s2';
    public const SITUATION_ORDER_MEAL_REFERENCE = 'situation-w2-r2-s1';
    public const SITUATION_CHANGE_ORDER_REFERENCE = 'situation-w2-r2-s2';
    public const SITUATION_CHOOSE_SHOWING_REFERENCE = 'situation-w2-r3-s1';
    public const SITUATION_BOOKING_PROBLEM_REFERENCE = 'situation-w2-r3-s2';
    public const SITUATION_FIND_SEAT_REFERENCE = 'situation-w2-r4-s1';
    public const SITUATION_BOOK_TICKETS_REFERENCE = 'situation-w2-r4-s2';
    public const SITUATION_FIND_YOUR_WAY_REFERENCE = 'situation-w2-r5-s1';
    public const SITUATION_LOST_ITEM_REFERENCE = 'situation-w2-r5-s2';
    public const SITUATION_SUGGEST_GAME_REFERENCE = 'situation-w2-r6-s1';
    public const SITUATION_EXCHANGE_TOKENS_REFERENCE = 'situation-w2-r6-s2';
    public const SITUATION_ORGANIZE_GAME_REFERENCE = 'situation-w2-r7-s1';
    public const SITUATION_CHEER_FRIEND_REFERENCE = 'situation-w2-r7-s2';
    public const SITUATION_ASK_EQUIPMENT_HELP_REFERENCE = 'situation-w2-r8-s1';
    public const SITUATION_JOIN_CLASS_REFERENCE = 'situation-w2-r8-s2';
    public const SITUATION_ASK_HOURS_REFERENCE = 'situation-w2-r9-s1';
    public const SITUATION_RENT_EQUIPMENT_REFERENCE = 'situation-w2-r9-s2';

    // Monde 3 - Voyage & transport
    public const SITUATION_FIND_GATE_REFERENCE = 'situation-w3-r1-s1';
    public const SITUATION_FLIGHT_DELAYED_REFERENCE = 'situation-w3-r1-s2';
    public const SITUATION_ANSWER_OFFICER_REFERENCE = 'situation-w3-r2-s1';
    public const SITUATION_MISSING_DOCUMENT_REFERENCE = 'situation-w3-r2-s2';
    public const SITUATION_LOST_LUGGAGE_REFERENCE = 'situation-w3-r3-s1';
    public const SITUATION_DAMAGED_LUGGAGE_REFERENCE = 'situation-w3-r3-s2';
    public const SITUATION_BUY_TRAIN_TICKET_REFERENCE = 'situation-w3-r4-s1';
    public const SITUATION_MISSED_TRAIN_REFERENCE = 'situation-w3-r4-s2';
    public const SITUATION_FIND_METRO_ROUTE_REFERENCE = 'situation-w3-r5-s1';
    public const SITUATION_METRO_TICKET_PROBLEM_REFERENCE = 'situation-w3-r5-s2';
    public const SITUATION_FIND_RIGHT_BUS_REFERENCE = 'situation-w3-r6-s1';
    public const SITUATION_BUS_FULL_REFERENCE = 'situation-w3-r6-s2';
    public const SITUATION_EXPLAIN_DESTINATION_REFERENCE = 'situation-w3-r7-s1';
    public const SITUATION_FARE_PROBLEM_REFERENCE = 'situation-w3-r7-s2';
    public const SITUATION_RENT_CAR_REFERENCE = 'situation-w3-r8-s1';
    public const SITUATION_VEHICLE_PROBLEM_REFERENCE = 'situation-w3-r8-s2';
    public const SITUATION_ASK_GAS_STATION_HELP_REFERENCE = 'situation-w3-r9-s1';
    public const SITUATION_ASK_DIRECTIONS_REFERENCE = 'situation-w3-r9-s2';
    public const SITUATION_ORGANIZE_VISIT_REFERENCE = 'situation-w3-r10-s1';
    public const SITUATION_BOOK_ACTIVITY_REFERENCE = 'situation-w3-r10-s2';

    // Monde 4 - Vacances & aventure
    public const SITUATION_HOTEL_CHECKIN_REFERENCE = 'situation-w4-r1-s1';
    public const SITUATION_BOOKING_ISSUE_REFERENCE = 'situation-w4-r1-s2';
    public const SITUATION_RENT_BEACH_EQUIPMENT_REFERENCE = 'situation-w4-r2-s1';
    public const SITUATION_BOOK_BEACH_CLASS_REFERENCE = 'situation-w4-r2-s2';
    public const SITUATION_ORGANIZE_EXCURSION_REFERENCE = 'situation-w4-r3-s1';
    public const SITUATION_CAMPSITE_ISSUE_REFERENCE = 'situation-w4-r3-s2';
    public const SITUATION_FIND_CABIN_REFERENCE = 'situation-w4-r4-s1';
    public const SITUATION_JOIN_SHIP_ACTIVITY_REFERENCE = 'situation-w4-r4-s2';
    public const SITUATION_BUY_MUSEUM_TICKET_REFERENCE = 'situation-w4-r5-s1';
    public const SITUATION_ASK_GUIDED_TOUR_REFERENCE = 'situation-w4-r5-s2';

    // Monde 5 - Travail & études
    public const SITUATION_FIRST_DAY_SCHOOL_REFERENCE = 'situation-w5-r1-s1';
    public const SITUATION_FIND_CLASSROOM_REFERENCE = 'situation-w5-r1-s2';
    public const SITUATION_GROUP_LAB_TASK_REFERENCE = 'situation-w5-r2-s1';
    public const SITUATION_ASK_LAB_HELP_REFERENCE = 'situation-w5-r2-s2';
    public const SITUATION_JOB_INTERVIEW_REFERENCE = 'situation-w5-r3-s1';
    public const SITUATION_NEGOTIATE_TERMS_REFERENCE = 'situation-w5-r3-s2';
    public const SITUATION_FIRST_DAY_WORK_REFERENCE = 'situation-w5-r4-s1';
    public const SITUATION_ASK_COLLEAGUE_HELP_REFERENCE = 'situation-w5-r4-s2';
    public const SITUATION_PRESENT_IDEA_REFERENCE = 'situation-w5-r5-s1';
    public const SITUATION_ANSWER_OBJECTIONS_REFERENCE = 'situation-w5-r5-s2';
    public const SITUATION_CUSTOMER_ISSUE_REFERENCE = 'situation-w5-r6-s1';
    public const SITUATION_FOLLOW_UP_TICKET_REFERENCE = 'situation-w5-r6-s2';
    public const SITUATION_LIBRARY_INFO_REFERENCE = 'situation-w5-r7-s1';
    public const SITUATION_BORROW_BOOK_REFERENCE = 'situation-w5-r7-s2';

    // Monde 6 - Services & ville
    public const SITUATION_BANK_INFO_REFERENCE = 'situation-w6-r1-s1';
    public const SITUATION_BANK_ISSUE_REFERENCE = 'situation-w6-r1-s2';
    public const SITUATION_SEND_PACKAGE_REFERENCE = 'situation-w6-r2-s1';
    public const SITUATION_TRACK_SHIPMENT_REFERENCE = 'situation-w6-r2-s2';
    public const SITUATION_COMPARE_DEVICES_REFERENCE = 'situation-w6-r3-s1';
    public const SITUATION_REPAIR_DEVICE_REFERENCE = 'situation-w6-r3-s2';
    public const SITUATION_EXPLAIN_CAR_ISSUE_REFERENCE = 'situation-w6-r4-s1';
    public const SITUATION_ASK_REPAIR_QUOTE_REFERENCE = 'situation-w6-r4-s2';
    public const SITUATION_LOOK_FOR_APARTMENT_REFERENCE = 'situation-w6-r5-s1';
    public const SITUATION_ASK_LEASE_TERMS_REFERENCE = 'situation-w6-r5-s2';
    public const SITUATION_ASK_VIEWING_QUESTIONS_REFERENCE = 'situation-w6-r6-s1';
    public const SITUATION_NEGOTIATE_RENT_REFERENCE = 'situation-w6-r6-s2';
    public const SITUATION_REPORT_LOST_ITEM_REFERENCE = 'situation-w6-r7-s1';
    public const SITUATION_FILE_REPORT_REFERENCE = 'situation-w6-r7-s2';

    // Monde 7 - Santé & imprévus
    public const SITUATION_DESCRIBE_SYMPTOMS_REFERENCE = 'situation-w7-r1-s1';
    public const SITUATION_ASK_PRESCRIPTION_REFERENCE = 'situation-w7-r1-s2';
    public const SITUATION_ASK_PHARMACY_PRODUCT_REFERENCE = 'situation-w7-r2-s1';
    public const SITUATION_ASK_MEDICATION_QUESTION_REFERENCE = 'situation-w7-r2-s2';
    public const SITUATION_EXPLAIN_DENTAL_PAIN_REFERENCE = 'situation-w7-r3-s1';
    public const SITUATION_BOOK_DENTAL_APPOINTMENT_REFERENCE = 'situation-w7-r3-s2';
    public const SITUATION_EXPLAIN_EMERGENCY_REFERENCE = 'situation-w7-r4-s1';
    public const SITUATION_ANSWER_ER_QUESTIONS_REFERENCE = 'situation-w7-r4-s2';

    // Monde 8 - Relations sociales
    public const SITUATION_MEET_SOMEONE_REFERENCE = 'situation-w8-r1-s1';
    public const SITUATION_JOIN_GROUP_CONVERSATION_REFERENCE = 'situation-w8-r1-s2';

    /**
     * [reference, roomReference, code, title, description].
     */
    private const SITUATIONS = [
        [self::SITUATION_RAINY_DAY_REFERENCE, RoomFixtures::ROOM_LIVING_ROOM_REFERENCE, 'W1-R1-S1', 'Rainy Day Plans', "Il pleut dehors et tes plans sont annulés - trouve une activité d'intérieur."],
        [self::SITUATION_DINNER_REFERENCE, RoomFixtures::ROOM_LIVING_ROOM_REFERENCE, 'W1-R1-S2', 'Préparer le dîner', 'Avec ton/ta colocataire, décidez quoi cuisiner ce soir.'],

        [self::SITUATION_RECIPE_REFERENCE, RoomFixtures::ROOM_KITCHEN_REFERENCE, 'W1-R2-S1', 'Suivre une recette', "Cuisine avec un proche en suivant une recette pas à pas."],
        [self::SITUATION_MISSING_INGREDIENT_REFERENCE, RoomFixtures::ROOM_KITCHEN_REFERENCE, 'W1-R2-S2', 'Un ingrédient manquant', "Il manque un ingrédient pour la recette - trouvez une solution."],

        [self::SITUATION_PACK_SUITCASE_REFERENCE, RoomFixtures::ROOM_BEDROOM_REFERENCE, 'W1-R3-S1', 'Préparer une valise', "Prépare ta valise pour un voyage avec l'aide d'un proche."],
        [self::SITUATION_FIND_OUTFIT_REFERENCE, RoomFixtures::ROOM_BEDROOM_REFERENCE, 'W1-R3-S2', 'Trouver une tenue', "Demande conseil pour choisir une tenue pour une occasion."],

        [self::SITUATION_GROCERY_SHOPPING_REFERENCE, RoomFixtures::ROOM_SUPERMARKET_REFERENCE, 'W1-R4-S1', 'Faire les courses', 'Trouve les articles de ta liste de courses au supermarché.'],
        [self::SITUATION_CHECKOUT_PROBLEM_REFERENCE, RoomFixtures::ROOM_SUPERMARKET_REFERENCE, 'W1-R4-S2', 'Problème à la caisse', 'Un problème de prix survient à la caisse - explique-le au caissier.'],

        [self::SITUATION_BUY_BREAKFAST_REFERENCE, RoomFixtures::ROOM_BAKERY_REFERENCE, 'W1-R5-S1', 'Acheter le petit-déjeuner', 'Commande du pain et des viennoiseries à la boulangerie.'],
        [self::SITUATION_SPECIAL_ORDER_REFERENCE, RoomFixtures::ROOM_BAKERY_REFERENCE, 'W1-R5-S2', 'Commande spéciale', 'Passe une commande spéciale pour une occasion.'],

        [self::SITUATION_BUY_CLOTHES_REFERENCE, RoomFixtures::ROOM_CLOTHING_SHOP_REFERENCE, 'W1-R6-S1', 'Choisir et acheter des vêtements', "Demande de l'aide pour choisir et acheter des vêtements."],
        [self::SITUATION_FITTING_ROOM_REFERENCE, RoomFixtures::ROOM_CLOTHING_SHOP_REFERENCE, 'W1-R6-S2', 'Essayage et retour', "Un vêtement ne convient pas - gère l'essayage ou le retour."],

        [self::SITUATION_DESCRIBE_HAIRCUT_REFERENCE, RoomFixtures::ROOM_HAIR_SALON_REFERENCE, 'W1-R7-S1', 'Expliquer la coupe souhaitée', 'Explique au coiffeur la coupe que tu souhaites.'],
        [self::SITUATION_BOOK_APPOINTMENT_REFERENCE, RoomFixtures::ROOM_HAIR_SALON_REFERENCE, 'W1-R7-S2', 'Prendre rendez-vous', 'Prends ou modifie un rendez-vous chez le coiffeur.'],

        [self::SITUATION_ORDER_COFFEE_REFERENCE, RoomFixtures::ROOM_COFFEE_SHOP_REFERENCE, 'W2-R1-S1', 'Commander un café', 'Commande une boisson au comptoir.'],
        [self::SITUATION_WRONG_ORDER_REFERENCE, RoomFixtures::ROOM_COFFEE_SHOP_REFERENCE, 'W2-R1-S2', 'Mauvaise commande', "Le barista s'est trompé - explique le problème et obtiens la bonne boisson."],

        [self::SITUATION_ORDER_MEAL_REFERENCE, RoomFixtures::ROOM_RESTAURANT_REFERENCE, 'W2-R2-S1', 'Commander un repas', 'Commande une entrée et un plat au restaurant.'],
        [self::SITUATION_CHANGE_ORDER_REFERENCE, RoomFixtures::ROOM_RESTAURANT_REFERENCE, 'W2-R2-S2', 'Modifier sa commande', 'Un plat pose problème - demande à le changer ou à le faire refaire.'],

        [self::SITUATION_CHOOSE_SHOWING_REFERENCE, RoomFixtures::ROOM_CINEMA_REFERENCE, 'W2-R3-S1', 'Choisir une séance', 'Achète un billet pour une séance de cinéma.'],
        [self::SITUATION_BOOKING_PROBLEM_REFERENCE, RoomFixtures::ROOM_CINEMA_REFERENCE, 'W2-R3-S2', 'Problème de réservation', 'Ta réservation pose problème - explique-le à la caissière.'],

        [self::SITUATION_FIND_SEAT_REFERENCE, RoomFixtures::ROOM_THEATRE_REFERENCE, 'W2-R4-S1', 'Trouver sa place', 'Demande à un ouvreur de t\'aider à trouver ta place.'],
        [self::SITUATION_BOOK_TICKETS_REFERENCE, RoomFixtures::ROOM_THEATRE_REFERENCE, 'W2-R4-S2', 'Réserver des billets', 'Achète des billets pour une pièce de théâtre.'],

        [self::SITUATION_FIND_YOUR_WAY_REFERENCE, RoomFixtures::ROOM_CONCERT_HALL_REFERENCE, 'W2-R5-S1', 'Se repérer pendant un événement', "Demande ton chemin à un membre du personnel pendant un concert."],
        [self::SITUATION_LOST_ITEM_REFERENCE, RoomFixtures::ROOM_CONCERT_HALL_REFERENCE, 'W2-R5-S2', 'Objet perdu', 'Tu as perdu un objet pendant le concert - signale-le.'],

        [self::SITUATION_SUGGEST_GAME_REFERENCE, RoomFixtures::ROOM_ARCADE_REFERENCE, 'W2-R6-S1', 'Proposer une partie', 'Propose à un ami de jouer à un jeu d\'arcade.'],
        [self::SITUATION_EXCHANGE_TOKENS_REFERENCE, RoomFixtures::ROOM_ARCADE_REFERENCE, 'W2-R6-S2', 'Échanger des jetons', "Échange de la monnaie contre des jetons de jeu."],

        [self::SITUATION_ORGANIZE_GAME_REFERENCE, RoomFixtures::ROOM_BOWLING_REFERENCE, 'W2-R7-S1', 'Organiser une partie', 'Réserve une piste de bowling avec un ami.'],
        [self::SITUATION_CHEER_FRIEND_REFERENCE, RoomFixtures::ROOM_BOWLING_REFERENCE, 'W2-R7-S2', 'Encourager un ami', 'Discute de la partie et encourage un ami qui joue.'],

        [self::SITUATION_ASK_EQUIPMENT_HELP_REFERENCE, RoomFixtures::ROOM_GYM_REFERENCE, 'W2-R8-S1', "Demander de l'aide sur un équipement", 'Demande à un employé comment utiliser un appareil de sport.'],
        [self::SITUATION_JOIN_CLASS_REFERENCE, RoomFixtures::ROOM_GYM_REFERENCE, 'W2-R8-S2', "S'inscrire à un cours", "Renseigne-toi sur les cours collectifs et inscris-toi."],

        [self::SITUATION_ASK_HOURS_REFERENCE, RoomFixtures::ROOM_SWIMMING_POOL_REFERENCE, 'W2-R9-S1', 'Demander horaires et informations', "Demande les horaires d'ouverture de la piscine."],
        [self::SITUATION_RENT_EQUIPMENT_REFERENCE, RoomFixtures::ROOM_SWIMMING_POOL_REFERENCE, 'W2-R9-S2', 'Louer du matériel', 'Demande à louer un casier ou une serviette.'],

        [self::SITUATION_FIND_GATE_REFERENCE, RoomFixtures::ROOM_AIRPORT_TERMINAL_REFERENCE, 'W3-R1-S1', "Trouver sa porte d'embarquement", "Trouve ta porte d'embarquement à l'aéroport."],
        [self::SITUATION_FLIGHT_DELAYED_REFERENCE, RoomFixtures::ROOM_AIRPORT_TERMINAL_REFERENCE, 'W3-R1-S2', 'Vol retardé', 'Ton vol est retardé - renseigne-toi auprès du personnel.'],

        [self::SITUATION_ANSWER_OFFICER_REFERENCE, RoomFixtures::ROOM_PASSPORT_CONTROL_REFERENCE, 'W3-R2-S1', "Répondre à l'agent", 'Réponds aux questions de contrôle des passeports.'],
        [self::SITUATION_MISSING_DOCUMENT_REFERENCE, RoomFixtures::ROOM_PASSPORT_CONTROL_REFERENCE, 'W3-R2-S2', 'Document manquant', "Un document te manque - explique la situation à l'agent."],

        [self::SITUATION_LOST_LUGGAGE_REFERENCE, RoomFixtures::ROOM_BAGGAGE_CLAIM_REFERENCE, 'W3-R3-S1', 'Signaler un bagage perdu', 'Signale ton bagage manquant à un agent.'],
        [self::SITUATION_DAMAGED_LUGGAGE_REFERENCE, RoomFixtures::ROOM_BAGGAGE_CLAIM_REFERENCE, 'W3-R3-S2', 'Bagage endommagé', 'Ta valise est arrivée endommagée - signale-le.'],

        [self::SITUATION_BUY_TRAIN_TICKET_REFERENCE, RoomFixtures::ROOM_TRAIN_STATION_REFERENCE, 'W3-R4-S1', 'Acheter un billet', 'Achète un billet de train à la gare.'],
        [self::SITUATION_MISSED_TRAIN_REFERENCE, RoomFixtures::ROOM_TRAIN_STATION_REFERENCE, 'W3-R4-S2', 'Train manqué', 'Tu as manqué ton train - vois ce que tu peux faire.'],

        [self::SITUATION_FIND_METRO_ROUTE_REFERENCE, RoomFixtures::ROOM_METRO_STATION_REFERENCE, 'W3-R5-S1', 'Trouver son itinéraire', 'Trouve ton chemin dans le métro.'],
        [self::SITUATION_METRO_TICKET_PROBLEM_REFERENCE, RoomFixtures::ROOM_METRO_STATION_REFERENCE, 'W3-R5-S2', 'Ticket bloqué', 'Ton ticket ne fonctionne pas au portillon - signale-le.'],

        [self::SITUATION_FIND_RIGHT_BUS_REFERENCE, RoomFixtures::ROOM_BUS_STATION_REFERENCE, 'W3-R6-S1', 'Trouver le bon bus', 'Trouve le bus qui va à ta destination.'],
        [self::SITUATION_BUS_FULL_REFERENCE, RoomFixtures::ROOM_BUS_STATION_REFERENCE, 'W3-R6-S2', 'Bus complet', 'Le bus est complet - trouve une alternative.'],

        [self::SITUATION_EXPLAIN_DESTINATION_REFERENCE, RoomFixtures::ROOM_TAXI_REFERENCE, 'W3-R7-S1', 'Expliquer sa destination', 'Explique ta destination au chauffeur de taxi.'],
        [self::SITUATION_FARE_PROBLEM_REFERENCE, RoomFixtures::ROOM_TAXI_REFERENCE, 'W3-R7-S2', 'Problème de trajet', 'Un désaccord survient sur le prix ou le trajet - règle-le.'],

        [self::SITUATION_RENT_CAR_REFERENCE, RoomFixtures::ROOM_CAR_RENTAL_REFERENCE, 'W3-R8-S1', 'Louer une voiture', "Loue une voiture à l'agence de location."],
        [self::SITUATION_VEHICLE_PROBLEM_REFERENCE, RoomFixtures::ROOM_CAR_RENTAL_REFERENCE, 'W3-R8-S2', 'Problème avec le véhicule', 'Un problème survient avec la voiture louée - signale-le.'],

        [self::SITUATION_ASK_GAS_STATION_HELP_REFERENCE, RoomFixtures::ROOM_GAS_STATION_REFERENCE, 'W3-R9-S1', "Demander de l'aide", "Demande de l'aide à la station-service."],
        [self::SITUATION_ASK_DIRECTIONS_REFERENCE, RoomFixtures::ROOM_GAS_STATION_REFERENCE, 'W3-R9-S2', 'Itinéraire perdu', "Tu es perdu - demande ton chemin à l'employé."],

        [self::SITUATION_ORGANIZE_VISIT_REFERENCE, RoomFixtures::ROOM_TOURIST_OFFICE_REFERENCE, 'W3-R10-S1', 'Organiser une visite', "Demande des recommandations à l'office de tourisme."],
        [self::SITUATION_BOOK_ACTIVITY_REFERENCE, RoomFixtures::ROOM_TOURIST_OFFICE_REFERENCE, 'W3-R10-S2', 'Réserver une activité', 'Réserve une activité ou visite guidée.'],

        [self::SITUATION_HOTEL_CHECKIN_REFERENCE, RoomFixtures::ROOM_HOTEL_LOBBY_REFERENCE, 'W4-R1-S1', 'Faire son check-in', "Enregistre-toi à la réception de l'hôtel."],
        [self::SITUATION_BOOKING_ISSUE_REFERENCE, RoomFixtures::ROOM_HOTEL_LOBBY_REFERENCE, 'W4-R1-S2', 'Problème de réservation', 'Ta réservation pose problème - explique-le à la réception.'],

        [self::SITUATION_RENT_BEACH_EQUIPMENT_REFERENCE, RoomFixtures::ROOM_BEACH_CLUB_REFERENCE, 'W4-R2-S1', 'Louer du matériel', 'Loue du matériel de plage.'],
        [self::SITUATION_BOOK_BEACH_CLASS_REFERENCE, RoomFixtures::ROOM_BEACH_CLUB_REFERENCE, 'W4-R2-S2', 'Réserver un cours', 'Inscris-toi à un cours (surf, plongée, voile...).'],

        [self::SITUATION_ORGANIZE_EXCURSION_REFERENCE, RoomFixtures::ROOM_CAMPSITE_REFERENCE, 'W4-R3-S1', 'Organiser une excursion', 'Renseigne-toi sur les excursions proposées depuis le camping.'],
        [self::SITUATION_CAMPSITE_ISSUE_REFERENCE, RoomFixtures::ROOM_CAMPSITE_REFERENCE, 'W4-R3-S2', 'Problème sur le site', "Signale un problème avec ton emplacement ou ta cabane."],

        [self::SITUATION_FIND_CABIN_REFERENCE, RoomFixtures::ROOM_CRUISE_SHIP_REFERENCE, 'W4-R4-S1', 'Trouver sa cabine et les activités', "Demande ton chemin vers ta cabine et le programme d'activités."],
        [self::SITUATION_JOIN_SHIP_ACTIVITY_REFERENCE, RoomFixtures::ROOM_CRUISE_SHIP_REFERENCE, 'W4-R4-S2', 'S\'inscrire à une activité', 'Inscris-toi à une activité proposée à bord.'],

        [self::SITUATION_BUY_MUSEUM_TICKET_REFERENCE, RoomFixtures::ROOM_MUSEUM_REFERENCE, 'W4-R5-S1', 'Acheter son entrée', "Achète ton billet et demande des informations sur une œuvre."],
        [self::SITUATION_ASK_GUIDED_TOUR_REFERENCE, RoomFixtures::ROOM_MUSEUM_REFERENCE, 'W4-R5-S2', 'Demander une visite guidée', "Renseigne-toi sur les visites guidées du musée."],

        [self::SITUATION_FIRST_DAY_SCHOOL_REFERENCE, RoomFixtures::ROOM_LECTURE_HALL_REFERENCE, 'W5-R1-S1', 'Premier jour et rencontres', "C'est ton premier jour à l'université - fais connaissance avec d'autres étudiants."],
        [self::SITUATION_FIND_CLASSROOM_REFERENCE, RoomFixtures::ROOM_LECTURE_HALL_REFERENCE, 'W5-R1-S2', 'Trouver sa salle de cours', 'Tu es perdu dans le bâtiment - demande ton chemin.'],

        [self::SITUATION_GROUP_LAB_TASK_REFERENCE, RoomFixtures::ROOM_LABORATORY_REFERENCE, 'W5-R2-S1', 'Réaliser une tâche en groupe', 'Travaille avec un camarade sur une expérience de laboratoire.'],
        [self::SITUATION_ASK_LAB_HELP_REFERENCE, RoomFixtures::ROOM_LABORATORY_REFERENCE, 'W5-R2-S2', "Demander de l'aide sur un protocole", "Tu ne comprends pas une étape du protocole - demande de l'aide."],

        [self::SITUATION_JOB_INTERVIEW_REFERENCE, RoomFixtures::ROOM_INTERVIEW_ROOM_REFERENCE, 'W5-R3-S1', "Passer un entretien d'embauche", "Réponds aux questions d'un recruteur."],
        [self::SITUATION_NEGOTIATE_TERMS_REFERENCE, RoomFixtures::ROOM_INTERVIEW_ROOM_REFERENCE, 'W5-R3-S2', 'Négocier les conditions', "Discute du salaire et des conditions de travail avec le recruteur."],

        [self::SITUATION_FIRST_DAY_WORK_REFERENCE, RoomFixtures::ROOM_OPEN_SPACE_REFERENCE, 'W5-R4-S1', 'Premier jour de travail', "C'est ton premier jour - présente-toi à tes nouveaux collègues."],
        [self::SITUATION_ASK_COLLEAGUE_HELP_REFERENCE, RoomFixtures::ROOM_OPEN_SPACE_REFERENCE, 'W5-R4-S2', "Demander de l'aide à un collègue", "Tu bloques sur une tâche - demande de l'aide à un collègue."],

        [self::SITUATION_PRESENT_IDEA_REFERENCE, RoomFixtures::ROOM_MEETING_ROOM_REFERENCE, 'W5-R5-S1', 'Présenter une idée', 'Présente une idée à ton équipe en réunion.'],
        [self::SITUATION_ANSWER_OBJECTIONS_REFERENCE, RoomFixtures::ROOM_MEETING_ROOM_REFERENCE, 'W5-R5-S2', 'Répondre à des objections', "Défends ton idée face aux questions et objections de l'équipe."],

        [self::SITUATION_CUSTOMER_ISSUE_REFERENCE, RoomFixtures::ROOM_HELP_DESK_REFERENCE, 'W5-R6-S1', 'Résoudre un problème client', "Contacte le service client pour un problème."],
        [self::SITUATION_FOLLOW_UP_TICKET_REFERENCE, RoomFixtures::ROOM_HELP_DESK_REFERENCE, 'W5-R6-S2', 'Suivre une réclamation', "Relance le service client au sujet d'une demande non résolue."],

        [self::SITUATION_LIBRARY_INFO_REFERENCE, RoomFixtures::ROOM_LIBRARY_REFERENCE, 'W5-R7-S1', 'Chercher une information', 'Demande de l\'aide pour trouver un livre ou une ressource.'],
        [self::SITUATION_BORROW_BOOK_REFERENCE, RoomFixtures::ROOM_LIBRARY_REFERENCE, 'W5-R7-S2', 'Emprunter un livre', 'Emprunte un livre et renseigne-toi sur la durée du prêt.'],

        [self::SITUATION_BANK_INFO_REFERENCE, RoomFixtures::ROOM_BANK_REFERENCE, 'W6-R1-S1', 'Demander des informations', "Renseigne-toi sur l'ouverture d'un compte bancaire."],
        [self::SITUATION_BANK_ISSUE_REFERENCE, RoomFixtures::ROOM_BANK_REFERENCE, 'W6-R1-S2', 'Signaler un problème', 'Signale un problème avec ta carte ou ton compte.'],

        [self::SITUATION_SEND_PACKAGE_REFERENCE, RoomFixtures::ROOM_POST_OFFICE_REFERENCE, 'W6-R2-S1', 'Envoyer un colis', 'Envoie un colis au bureau de poste.'],
        [self::SITUATION_TRACK_SHIPMENT_REFERENCE, RoomFixtures::ROOM_POST_OFFICE_REFERENCE, 'W6-R2-S2', 'Suivre un envoi', "Renseigne-toi sur l'état d'un envoi."],

        [self::SITUATION_COMPARE_DEVICES_REFERENCE, RoomFixtures::ROOM_ELECTRONICS_STORE_REFERENCE, 'W6-R3-S1', 'Comparer des appareils', 'Compare deux appareils avec un vendeur.'],
        [self::SITUATION_REPAIR_DEVICE_REFERENCE, RoomFixtures::ROOM_ELECTRONICS_STORE_REFERENCE, 'W6-R3-S2', 'Faire réparer un appareil', 'Demande la réparation d\'un appareil défectueux.'],

        [self::SITUATION_EXPLAIN_CAR_ISSUE_REFERENCE, RoomFixtures::ROOM_GARAGE_REFERENCE, 'W6-R4-S1', 'Expliquer une panne', 'Explique le problème de ta voiture au garagiste.'],
        [self::SITUATION_ASK_REPAIR_QUOTE_REFERENCE, RoomFixtures::ROOM_GARAGE_REFERENCE, 'W6-R4-S2', 'Demander un devis', 'Demande un devis de réparation et le délai.'],

        [self::SITUATION_LOOK_FOR_APARTMENT_REFERENCE, RoomFixtures::ROOM_REAL_ESTATE_AGENCY_REFERENCE, 'W6-R5-S1', 'Chercher un logement', 'Décris le logement que tu recherches à un agent immobilier.'],
        [self::SITUATION_ASK_LEASE_TERMS_REFERENCE, RoomFixtures::ROOM_REAL_ESTATE_AGENCY_REFERENCE, 'W6-R5-S2', 'Poser des questions sur un contrat', 'Pose des questions sur les conditions du bail.'],

        [self::SITUATION_ASK_VIEWING_QUESTIONS_REFERENCE, RoomFixtures::ROOM_APARTMENT_VIEWING_REFERENCE, 'W6-R6-S1', 'Poser des questions', 'Visite un appartement et pose des questions à l\'agent.'],
        [self::SITUATION_NEGOTIATE_RENT_REFERENCE, RoomFixtures::ROOM_APARTMENT_VIEWING_REFERENCE, 'W6-R6-S2', 'Négocier le loyer', "Essaie de négocier le loyer ou les conditions de la location."],

        [self::SITUATION_REPORT_LOST_ITEM_REFERENCE, RoomFixtures::ROOM_POLICE_STATION_REFERENCE, 'W6-R7-S1', 'Signaler un objet perdu', 'Signale un objet perdu au commissariat.'],
        [self::SITUATION_FILE_REPORT_REFERENCE, RoomFixtures::ROOM_POLICE_STATION_REFERENCE, 'W6-R7-S2', 'Faire une déclaration', "Fais une déclaration détaillée pour un vol ou un incident."],

        [self::SITUATION_DESCRIBE_SYMPTOMS_REFERENCE, RoomFixtures::ROOM_DOCTOR_OFFICE_REFERENCE, 'W7-R1-S1', 'Décrire des symptômes', 'Décris tes symptômes au médecin.'],
        [self::SITUATION_ASK_PRESCRIPTION_REFERENCE, RoomFixtures::ROOM_DOCTOR_OFFICE_REFERENCE, 'W7-R1-S2', 'Demander une ordonnance', "Demande le renouvellement d'une ordonnance au médecin."],

        [self::SITUATION_ASK_PHARMACY_PRODUCT_REFERENCE, RoomFixtures::ROOM_PHARMACY_REFERENCE, 'W7-R2-S1', 'Demander un produit ou conseil', 'Demande un produit ou un conseil au pharmacien.'],
        [self::SITUATION_ASK_MEDICATION_QUESTION_REFERENCE, RoomFixtures::ROOM_PHARMACY_REFERENCE, 'W7-R2-S2', 'Poser une question sur un médicament', 'Pose une question sur la posologie ou les effets secondaires.'],

        [self::SITUATION_EXPLAIN_DENTAL_PAIN_REFERENCE, RoomFixtures::ROOM_DENTIST_OFFICE_REFERENCE, 'W7-R3-S1', 'Expliquer une douleur', 'Explique une douleur dentaire au dentiste.'],
        [self::SITUATION_BOOK_DENTAL_APPOINTMENT_REFERENCE, RoomFixtures::ROOM_DENTIST_OFFICE_REFERENCE, 'W7-R3-S2', 'Prendre rendez-vous', 'Prends rendez-vous chez le dentiste.'],

        [self::SITUATION_EXPLAIN_EMERGENCY_REFERENCE, RoomFixtures::ROOM_EMERGENCY_ROOM_REFERENCE, 'W7-R4-S1', 'Expliquer une situation urgente', 'Explique une situation urgente au personnel des urgences.'],
        [self::SITUATION_ANSWER_ER_QUESTIONS_REFERENCE, RoomFixtures::ROOM_EMERGENCY_ROOM_REFERENCE, 'W7-R4-S2', 'Répondre aux questions du personnel', 'Réponds aux questions du personnel soignant sur ta situation.'],

        [self::SITUATION_MEET_SOMEONE_REFERENCE, RoomFixtures::ROOM_PARTY_REFERENCE, 'W8-R1-S1', 'Rencontrer quelqu\'un et maintenir une conversation', 'Fais connaissance avec quelqu\'un à une fête.'],
        [self::SITUATION_JOIN_GROUP_CONVERSATION_REFERENCE, RoomFixtures::ROOM_PARTY_REFERENCE, 'W8-R1-S2', 'Rejoindre un groupe de discussion', "Rejoins un groupe de discussion déjà en cours."],
    ];

    public function load(ObjectManager $manager): void
    {
        $repository = $manager->getRepository(Situation::class);

        /** @var array<string, int> $orderNumByRoom */
        $orderNumByRoom = [];

        foreach (self::SITUATIONS as [$reference, $roomReference, $code, $title, $description]) {
            /** @var Room $room */
            $room = $this->getReference($roomReference, Room::class);
            $orderNum = $orderNumByRoom[$roomReference] ?? 0;

            $situation = $repository->findOneBy(['code' => $code]) ?? new Situation();
            $situation
                ->setRoom($room)
                ->setCode($code)
                ->setTitle($title)
                ->setDescription($description)
                ->setOrderNum($orderNum);
            $manager->persist($situation);
            $this->addReference($reference, $situation);

            $orderNumByRoom[$roomReference] = $orderNum + 1;
        }

        $manager->flush();
    }

    public function getDependencies(): array
    {
        return [RoomFixtures::class];
    }
}
