<?php

namespace App\DataFixtures;

use App\Entity\Level;
use App\Entity\Mission;
use App\Entity\Situation;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * One A1 and one A2 Mission per situation across Monde 1 (28, over 14
 * situations), Monde 2 (36, over 18 situations), Monde 3 (40, over 20
 * situations), Monde 4 (20, over 10 situations), Monde 5 (28, over 14
 * situations) and Monde 6 (28, over 14 situations) - the mechanism that
 * lets the same Situation stay relevant as the learner's level rises
 * (LinguaBot_V2_Conception.md §8's restaurant example: A1 orders simply, A2
 * asks questions/modifies the order). baseXp mirrors the v1.1 catalog's own
 * BASE_XP_BY_LEVEL (A1=60, A2=100) for consistency across the two systems.
 *
 * Update-in-place by code rather than blind insert - see WorldFixtures.
 */
final class MissionFixtures extends Fixture implements DependentFixtureInterface
{
    private const BASE_XP_BY_LEVEL = [
        'A1' => 60,
        'A2' => 100,
    ];

    /**
     * [situationReference, codePrefix, characterName, [A1 title, A1 objective], [A2 title, A2 objective]].
     */
    private const MISSIONS = [
        [
            SituationFixtures::SITUATION_RAINY_DAY_REFERENCE, 'W1-R1-S1', 'Friend',
            ['Proposer une activité simple', 'Suggest an alternative indoor activity to a friend.'],
            ['Organiser un après-midi', 'Suggest and negotiate an indoor activity plan with a friend, agreeing on timing.'],
        ],
        [
            SituationFixtures::SITUATION_DINNER_REFERENCE, 'W1-R1-S2', 'Roommate',
            ['Décider quoi cuisiner', 'Decide with your roommate what to cook for dinner tonight.'],
            ['Répartir les tâches', 'Discuss and split the cooking and shopping tasks with your roommate for dinner.'],
        ],
        [
            SituationFixtures::SITUATION_RECIPE_REFERENCE, 'W1-R2-S1', 'Family Member',
            ['Demander de l\'aide pour cuisiner', 'Ask a family member for help following a simple recipe, step by step.'],
            ['Donner des instructions de cuisine', 'Give and follow cooking instructions with a family member, clarifying steps you are unsure about.'],
        ],
        [
            SituationFixtures::SITUATION_MISSING_INGREDIENT_REFERENCE, 'W1-R2-S2', 'Family Member',
            ['Signaler un ingrédient manquant', 'Tell a family member an ingredient is missing and ask what to do.'],
            ['Trouver une solution ensemble', 'Discuss which ingredient is missing, suggest a substitute, and agree on a solution together.'],
        ],
        [
            SituationFixtures::SITUATION_PACK_SUITCASE_REFERENCE, 'W1-R3-S1', 'Family Member',
            ['Décider quoi emporter', 'Decide with a family member what to pack for a short trip.'],
            ['Planifier sa valise', 'Discuss what to pack for a trip considering the weather and planned activities, and check nothing is forgotten.'],
        ],
        [
            SituationFixtures::SITUATION_FIND_OUTFIT_REFERENCE, 'W1-R3-S2', 'Family Member',
            ['Demander un conseil simple', 'Ask a family member for advice on what to wear today.'],
            ['Justifier son choix', 'Discuss outfit options for a specific occasion and explain your choice.'],
        ],
        [
            SituationFixtures::SITUATION_GROCERY_SHOPPING_REFERENCE, 'W1-R4-S1', 'Supermarket Employee',
            ['Trouver un article', 'Ask a supermarket employee where to find an item on your shopping list.'],
            ['Comparer des produits', 'Ask a supermarket employee for help finding several items and compare two similar products.'],
        ],
        [
            SituationFixtures::SITUATION_CHECKOUT_PROBLEM_REFERENCE, 'W1-R4-S2', 'Cashier',
            ['Signaler un prix manquant', 'Tell the cashier that an item has no price tag and ask for help.'],
            ['Résoudre une erreur de prix', 'Explain a pricing mistake at checkout to the cashier and ask them to resolve it.'],
        ],
        [
            SituationFixtures::SITUATION_BUY_BREAKFAST_REFERENCE, 'W1-R5-S1', 'Baker',
            ['Commander le petit-déjeuner', 'Order bread and pastries for breakfast at the bakery.'],
            ['Demander des précisions', 'Order breakfast items at the bakery and ask about ingredients or allergens.'],
        ],
        [
            SituationFixtures::SITUATION_SPECIAL_ORDER_REFERENCE, 'W1-R5-S2', 'Baker',
            ['Demander un pain particulier', 'Ask the baker if they have a specific type of bread available today.'],
            ['Commander un gâteau', 'Order a custom cake for a birthday, explaining what you want and when you need it.'],
        ],
        [
            SituationFixtures::SITUATION_BUY_CLOTHES_REFERENCE, 'W1-R6-S1', 'Shop Assistant',
            ['Demander sa taille', 'Ask a shop assistant for your size in a piece of clothing.'],
            ['Choisir une tenue', 'Ask a shop assistant to help you choose an outfit for a specific occasion.'],
        ],
        [
            SituationFixtures::SITUATION_FITTING_ROOM_REFERENCE, 'W1-R6-S2', 'Shop Assistant',
            ['Essayer un vêtement', 'Ask to try on a piece of clothing and say whether it fits.'],
            ['Gérer un retour', "Explain that an item doesn't fit and ask about exchanging or returning it."],
        ],
        [
            SituationFixtures::SITUATION_DESCRIBE_HAIRCUT_REFERENCE, 'W1-R7-S1', 'Hairdresser',
            ['Décrire une coupe simple', 'Tell the hairdresser what type of haircut you want.'],
            ['Détailler ses attentes', 'Describe the haircut or style you want in detail and discuss options with the hairdresser.'],
        ],
        [
            SituationFixtures::SITUATION_BOOK_APPOINTMENT_REFERENCE, 'W1-R7-S2', 'Hairdresser',
            ['Prendre un rendez-vous', 'Book a hair appointment for a specific day and time.'],
            ['Déplacer un rendez-vous', 'Reschedule an existing hair appointment and explain why.'],
        ],

        [
            SituationFixtures::SITUATION_ORDER_COFFEE_REFERENCE, 'W2-R1-S1', 'Barista',
            ['Commander une boisson simple', 'Order a drink at the coffee shop.'],
            ['Personnaliser sa commande', 'Order a drink at the coffee shop and ask for a modification, such as the size or the type of milk.'],
        ],
        [
            SituationFixtures::SITUATION_WRONG_ORDER_REFERENCE, 'W2-R1-S2', 'Barista',
            ['Signaler une erreur simple', 'Politely tell the barista your order is wrong and ask for the right one.'],
            ['Résoudre le problème', 'Explain the mistake in your order, ask for a solution, and confirm the correction.'],
        ],
        [
            SituationFixtures::SITUATION_ORDER_MEAL_REFERENCE, 'W2-R2-S1', 'Waiter',
            ['Commander un plat simple', 'Order a starter and a main course at the restaurant.'],
            ['Signaler une allergie', 'Order a full meal at the restaurant and ask about ingredients because of a food allergy.'],
        ],
        [
            SituationFixtures::SITUATION_CHANGE_ORDER_REFERENCE, 'W2-R2-S2', 'Waiter',
            ['Demander un changement', 'Ask the waiter to change one item in your order.'],
            ['Expliquer un problème', 'Explain a problem with your meal to the waiter and ask for a solution.'],
        ],
        [
            SituationFixtures::SITUATION_CHOOSE_SHOWING_REFERENCE, 'W2-R3-S1', 'Cinema Cashier',
            ['Acheter un billet', 'Buy a ticket for a movie showing at the cinema.'],
            ['Choisir un horaire', 'Ask about showtimes for a movie and choose the best option for your schedule.'],
        ],
        [
            SituationFixtures::SITUATION_BOOKING_PROBLEM_REFERENCE, 'W2-R3-S2', 'Cinema Cashier',
            ['Signaler un problème', 'Tell the cashier there is a problem with your ticket.'],
            ['Résoudre une réservation', 'Explain a booking problem in detail and ask the cashier to resolve it.'],
        ],
        [
            SituationFixtures::SITUATION_FIND_SEAT_REFERENCE, 'W2-R4-S1', 'Usher',
            ['Trouver sa place', 'Ask an usher to help you find your seat at the theatre.'],
            ['Changer de place', 'Ask an usher about seat options and request to change seats.'],
        ],
        [
            SituationFixtures::SITUATION_BOOK_TICKETS_REFERENCE, 'W2-R4-S2', 'Box Office Clerk',
            ['Acheter des billets', 'Buy tickets for a play at the theatre.'],
            ['Choisir pour un groupe', 'Ask about ticket options for a play and choose seats for a group.'],
        ],
        [
            SituationFixtures::SITUATION_FIND_YOUR_WAY_REFERENCE, 'W2-R5-S1', 'Staff Member',
            ['Demander son chemin', 'Ask a staff member where the entrance or restrooms are during a concert.'],
            ['Se renseigner sur le programme', 'Ask a staff member for directions and information about the concert schedule.'],
        ],
        [
            SituationFixtures::SITUATION_LOST_ITEM_REFERENCE, 'W2-R5-S2', 'Staff Member',
            ['Signaler un objet perdu', 'Tell a staff member you lost an item at the concert.'],
            ['Décrire un objet en détail', 'Describe a lost item in detail and ask staff how to find it.'],
        ],
        [
            SituationFixtures::SITUATION_SUGGEST_GAME_REFERENCE, 'W2-R6-S1', 'Friend',
            ['Proposer un jeu', 'Ask a friend to play an arcade game with you.'],
            ['Expliquer les règles', 'Suggest a game to a friend and explain the rules.'],
        ],
        [
            SituationFixtures::SITUATION_EXCHANGE_TOKENS_REFERENCE, 'W2-R6-S2', 'Staff Member',
            ['Échanger des jetons', 'Ask staff to exchange money for game tokens.'],
            ['Optimiser son échange', 'Ask about the best value for tokens and how to redeem prizes.'],
        ],
        [
            SituationFixtures::SITUATION_ORGANIZE_GAME_REFERENCE, 'W2-R7-S1', 'Staff Member',
            ['Réserver une piste', 'Book a bowling lane with a friend.'],
            ['Organiser pour un groupe', 'Book a bowling lane for a group and ask about shoe rental.'],
        ],
        [
            SituationFixtures::SITUATION_CHEER_FRIEND_REFERENCE, 'W2-R7-S2', 'Friend',
            ['Encourager un ami', 'Cheer on a friend during a bowling game.'],
            ['Discuter de la partie', "Discuss the game's score and suggest a strategy to a friend."],
        ],
        [
            SituationFixtures::SITUATION_ASK_EQUIPMENT_HELP_REFERENCE, 'W2-R8-S1', 'Gym Staff',
            ['Demander de l\'aide simple', 'Ask a gym staff member how to use a piece of equipment.'],
            ['Demander la bonne posture', 'Ask a gym staff member to explain proper form for an exercise.'],
        ],
        [
            SituationFixtures::SITUATION_JOIN_CLASS_REFERENCE, 'W2-R8-S2', 'Gym Staff',
            ['Se renseigner sur les cours', 'Ask about a fitness class schedule.'],
            ["S'inscrire selon ses objectifs", 'Ask about different fitness classes and sign up for one that fits your goals.'],
        ],
        [
            SituationFixtures::SITUATION_ASK_HOURS_REFERENCE, 'W2-R9-S1', 'Lifeguard',
            ['Demander les horaires', "Ask a lifeguard about the pool's opening hours."],
            ['Se renseigner sur les règles', 'Ask a lifeguard about pool rules and opening hours for different activities.'],
        ],
        [
            SituationFixtures::SITUATION_RENT_EQUIPMENT_REFERENCE, 'W2-R9-S2', 'Staff Member',
            ['Louer un casier', 'Ask to rent a locker or a towel at the pool.'],
            ['Comparer les options', 'Ask about rental options and prices for pool equipment.'],
        ],

        [
            SituationFixtures::SITUATION_FIND_GATE_REFERENCE, 'W3-R1-S1', 'Gate Agent',
            ['Trouver sa porte', 'Ask a gate agent for directions to your boarding gate.'],
            ['Demander un changement', 'Ask a gate agent about a gate change and confirm your boarding time.'],
        ],
        [
            SituationFixtures::SITUATION_FLIGHT_DELAYED_REFERENCE, 'W3-R1-S2', 'Airport Staff',
            ['Signaler un retard', 'Ask an airport staff member about a delayed flight.'],
            ['Demander des solutions', 'Ask an airport staff member about rebooking options for a delayed flight.'],
        ],
        [
            SituationFixtures::SITUATION_ANSWER_OFFICER_REFERENCE, 'W3-R2-S1', 'Passport Officer',
            ['Présenter son passeport', "Answer a passport control officer's basic questions about your trip."],
            ['Justifier son séjour', "Answer a passport control officer's detailed questions about the purpose and length of your stay."],
        ],
        [
            SituationFixtures::SITUATION_MISSING_DOCUMENT_REFERENCE, 'W3-R2-S2', 'Passport Officer',
            ['Expliquer un oubli', 'Tell the officer you forgot a document and ask what to do.'],
            ['Trouver une solution', 'Explain a missing document issue in detail and discuss solutions with the officer.'],
        ],
        [
            SituationFixtures::SITUATION_LOST_LUGGAGE_REFERENCE, 'W3-R3-S1', 'Baggage Claim Agent',
            ['Signaler un bagage manquant', 'Tell a baggage claim agent your suitcase is missing.'],
            ['Décrire son bagage', 'Describe your lost suitcase in detail and fill out a report with the agent.'],
        ],
        [
            SituationFixtures::SITUATION_DAMAGED_LUGGAGE_REFERENCE, 'W3-R3-S2', 'Baggage Claim Agent',
            ['Signaler un dommage', 'Tell the agent your suitcase arrived damaged.'],
            ['Demander une compensation', 'Explain the damage to your suitcase and ask about compensation.'],
        ],
        [
            SituationFixtures::SITUATION_BUY_TRAIN_TICKET_REFERENCE, 'W3-R4-S1', 'Ticket Agent',
            ['Acheter un billet simple', 'Buy a train ticket to a specific destination.'],
            ['Comparer des trajets', 'Ask a ticket agent about different train options and choose the best one for your schedule.'],
        ],
        [
            SituationFixtures::SITUATION_MISSED_TRAIN_REFERENCE, 'W3-R4-S2', 'Ticket Agent',
            ['Signaler un train manqué', 'Tell the ticket agent you missed your train and ask what to do.'],
            ['Échanger son billet', 'Ask the ticket agent to exchange your ticket for the next available train.'],
        ],
        [
            SituationFixtures::SITUATION_FIND_METRO_ROUTE_REFERENCE, 'W3-R5-S1', 'Metro Staff',
            ['Demander son chemin', 'Ask a metro staff member how to get to a specific station.'],
            ['Planifier un trajet', 'Ask a metro staff member about the best route with a connection to reach your destination.'],
        ],
        [
            SituationFixtures::SITUATION_METRO_TICKET_PROBLEM_REFERENCE, 'W3-R5-S2', 'Metro Staff',
            ['Signaler un problème de ticket', "Tell a metro staff member your ticket isn't working at the gate."],
            ['Résoudre un problème de carte', 'Explain a problem with your metro card and ask staff to fix it.'],
        ],
        [
            SituationFixtures::SITUATION_FIND_RIGHT_BUS_REFERENCE, 'W3-R6-S1', 'Bus Station Staff',
            ['Trouver son bus', 'Ask a bus station staff member which bus goes to your destination.'],
            ['Vérifier les horaires', 'Ask a staff member about bus schedules and confirm the best departure time.'],
        ],
        [
            SituationFixtures::SITUATION_BUS_FULL_REFERENCE, 'W3-R6-S2', 'Bus Station Staff',
            ['Signaler un bus complet', 'Tell a staff member the bus is full and ask what to do.'],
            ['Trouver une alternative', 'Discuss alternative bus options with staff after missing a full bus.'],
        ],
        [
            SituationFixtures::SITUATION_EXPLAIN_DESTINATION_REFERENCE, 'W3-R7-S1', 'Taxi Driver',
            ['Donner une destination', 'Tell a taxi driver your destination.'],
            ['Discuter du trajet', 'Discuss the best route and estimated fare with a taxi driver.'],
        ],
        [
            SituationFixtures::SITUATION_FARE_PROBLEM_REFERENCE, 'W3-R7-S2', 'Taxi Driver',
            ['Signaler un problème', 'Tell the taxi driver about a problem with the fare or the route.'],
            ['Négocier une solution', 'Discuss a disagreement about the fare with the taxi driver and agree on a solution.'],
        ],
        [
            SituationFixtures::SITUATION_RENT_CAR_REFERENCE, 'W3-R8-S1', 'Rental Agent',
            ['Louer une voiture simple', 'Rent a car for a few days at the rental agency.'],
            ['Comparer des options', 'Ask a rental agent about different car options, insurance, and mileage limits.'],
        ],
        [
            SituationFixtures::SITUATION_VEHICLE_PROBLEM_REFERENCE, 'W3-R8-S2', 'Rental Agent',
            ['Signaler un problème', 'Tell the rental agent about a problem with the car.'],
            ['Demander un échange', 'Explain a problem with the rented car in detail and ask for a replacement or refund.'],
        ],
        [
            SituationFixtures::SITUATION_ASK_GAS_STATION_HELP_REFERENCE, 'W3-R9-S1', 'Gas Station Attendant',
            ["Demander de l'aide simple", 'Ask a gas station attendant for help finding something.'],
            ['Résoudre un problème', 'Ask a gas station attendant for help after a problem with the pump or payment.'],
        ],
        [
            SituationFixtures::SITUATION_ASK_DIRECTIONS_REFERENCE, 'W3-R9-S2', 'Gas Station Attendant',
            ['Demander son chemin', 'Ask a gas station attendant for directions to a nearby place.'],
            ['Demander un itinéraire détaillé', 'Ask a gas station attendant for detailed directions and confirm the route back.'],
        ],
        [
            SituationFixtures::SITUATION_ORGANIZE_VISIT_REFERENCE, 'W3-R10-S1', 'Tourist Office Staff',
            ['Demander des recommandations', 'Ask tourist office staff for recommendations on what to visit.'],
            ['Planifier un itinéraire', 'Ask tourist office staff to help plan a day of visits based on your interests.'],
        ],
        [
            SituationFixtures::SITUATION_BOOK_ACTIVITY_REFERENCE, 'W3-R10-S2', 'Tourist Office Staff',
            ['Réserver une activité simple', 'Ask tourist office staff to book a simple activity or tour.'],
            ['Comparer des activités', 'Ask tourist office staff about different tours and book the one that fits your schedule.'],
        ],

        [
            SituationFixtures::SITUATION_HOTEL_CHECKIN_REFERENCE, 'W4-R1-S1', 'Hotel Receptionist',
            ['Faire son check-in', 'Check in at the hotel reception.'],
            ['Demander une amélioration', 'Check in and ask about a room upgrade or a late check-out.'],
        ],
        [
            SituationFixtures::SITUATION_BOOKING_ISSUE_REFERENCE, 'W4-R1-S2', 'Hotel Receptionist',
            ['Signaler un problème', 'Tell the receptionist there is a problem with your booking.'],
            ['Résoudre le problème', 'Explain a booking problem in detail and ask the receptionist to resolve it.'],
        ],
        [
            SituationFixtures::SITUATION_RENT_BEACH_EQUIPMENT_REFERENCE, 'W4-R2-S1', 'Beach Club Staff',
            ['Louer du matériel simple', 'Rent basic beach equipment, like a sunbed or umbrella.'],
            ['Comparer des options', 'Ask about different rental options and prices for beach equipment.'],
        ],
        [
            SituationFixtures::SITUATION_BOOK_BEACH_CLASS_REFERENCE, 'W4-R2-S2', 'Beach Instructor',
            ["S'inscrire à un cours", 'Sign up for a beginner surf or swimming lesson.'],
            ['Choisir son niveau', 'Ask about different class levels and choose the one that fits your experience.'],
        ],
        [
            SituationFixtures::SITUATION_ORGANIZE_EXCURSION_REFERENCE, 'W4-R3-S1', 'Campsite Staff',
            ['Se renseigner sur une excursion', 'Ask about an excursion offered from the campsite.'],
            ['Comparer des excursions', 'Ask about different excursions and choose one that fits your schedule.'],
        ],
        [
            SituationFixtures::SITUATION_CAMPSITE_ISSUE_REFERENCE, 'W4-R3-S2', 'Campsite Staff',
            ['Signaler un problème simple', 'Tell campsite staff about a problem with your pitch or cabin.'],
            ['Demander une solution', 'Explain a problem with your pitch or cabin in detail and ask for a solution.'],
        ],
        [
            SituationFixtures::SITUATION_FIND_CABIN_REFERENCE, 'W4-R4-S1', 'Crew Member',
            ['Trouver sa cabine', 'Ask a crew member for directions to your cabin.'],
            ['Se renseigner sur le programme', "Ask a crew member for directions and information about the day's activities."],
        ],
        [
            SituationFixtures::SITUATION_JOIN_SHIP_ACTIVITY_REFERENCE, 'W4-R4-S2', 'Crew Member',
            ["S'inscrire à une activité simple", 'Sign up for an activity offered on board.'],
            ['Comparer des activités', 'Ask about different onboard activities and choose one that fits your schedule.'],
        ],
        [
            SituationFixtures::SITUATION_BUY_MUSEUM_TICKET_REFERENCE, 'W4-R5-S1', 'Museum Staff',
            ['Acheter son billet', 'Buy a ticket to enter the museum.'],
            ["Discuter d'une œuvre", 'Buy a ticket and ask a staff member about a specific artwork.'],
        ],
        [
            SituationFixtures::SITUATION_ASK_GUIDED_TOUR_REFERENCE, 'W4-R5-S2', 'Museum Staff',
            ['Se renseigner sur une visite', 'Ask about guided tour times at the museum.'],
            ['Réserver une visite guidée', 'Ask about different guided tours and book the one that fits your schedule.'],
        ],

        [
            SituationFixtures::SITUATION_FIRST_DAY_SCHOOL_REFERENCE, 'W5-R1-S1', 'Classmate',
            ['Se présenter', 'Introduce yourself to a classmate on your first day.'],
            ['Discuter de son parcours', 'Introduce yourself and talk about your studies and interests with a classmate.'],
        ],
        [
            SituationFixtures::SITUATION_FIND_CLASSROOM_REFERENCE, 'W5-R1-S2', 'Student',
            ['Demander son chemin', 'Ask another student for directions to your classroom.'],
            ["Se renseigner sur l'emploi du temps", 'Ask another student for directions and information about the class schedule.'],
        ],
        [
            SituationFixtures::SITUATION_GROUP_LAB_TASK_REFERENCE, 'W5-R2-S1', 'Lab Partner',
            ['Répartir les tâches', 'Agree with a lab partner on how to split a simple task.'],
            ['Discuter des résultats', 'Discuss the results of an experiment with a lab partner and agree on next steps.'],
        ],
        [
            SituationFixtures::SITUATION_ASK_LAB_HELP_REFERENCE, 'W5-R2-S2', 'Lab Partner',
            ["Demander de l'aide simple", 'Ask a lab partner for help understanding a step.'],
            ['Clarifier un protocole', 'Ask a lab partner to explain a procedure in detail and confirm you understood correctly.'],
        ],
        [
            SituationFixtures::SITUATION_JOB_INTERVIEW_REFERENCE, 'W5-R3-S1', 'Recruiter',
            ['Se présenter', "Answer a recruiter's basic questions about yourself."],
            ['Détailler son expérience', "Answer a recruiter's detailed questions about your experience and motivation."],
        ],
        [
            SituationFixtures::SITUATION_NEGOTIATE_TERMS_REFERENCE, 'W5-R3-S2', 'Recruiter',
            ['Poser une question simple', 'Ask the recruiter a simple question about the job.'],
            ['Négocier les conditions', 'Discuss salary and working conditions with the recruiter.'],
        ],
        [
            SituationFixtures::SITUATION_FIRST_DAY_WORK_REFERENCE, 'W5-R4-S1', 'Colleague',
            ['Se présenter', 'Introduce yourself to a new colleague on your first day.'],
            ["Se renseigner sur l'équipe", 'Introduce yourself and ask a colleague about the team and how things work.'],
        ],
        [
            SituationFixtures::SITUATION_ASK_COLLEAGUE_HELP_REFERENCE, 'W5-R4-S2', 'Colleague',
            ["Demander de l'aide simple", 'Ask a colleague for help with a simple task.'],
            ['Expliquer un blocage', "Explain what you're stuck on in detail and ask a colleague for advice."],
        ],
        [
            SituationFixtures::SITUATION_PRESENT_IDEA_REFERENCE, 'W5-R5-S1', 'Team Member',
            ['Présenter une idée simple', 'Present a simple idea to your team.'],
            ['Détailler sa proposition', "Present an idea to your team and explain its benefits in detail."],
        ],
        [
            SituationFixtures::SITUATION_ANSWER_OBJECTIONS_REFERENCE, 'W5-R5-S2', 'Team Member',
            ['Répondre à une question', 'Answer a simple question about your idea.'],
            ['Défendre son idée', 'Respond to objections about your idea and defend your reasoning.'],
        ],
        [
            SituationFixtures::SITUATION_CUSTOMER_ISSUE_REFERENCE, 'W5-R6-S1', 'Support Agent',
            ['Expliquer un problème simple', 'Explain a simple problem to customer support.'],
            ['Détailler un problème', 'Explain a problem in detail to customer support and ask for a solution.'],
        ],
        [
            SituationFixtures::SITUATION_FOLLOW_UP_TICKET_REFERENCE, 'W5-R6-S2', 'Support Agent',
            ['Relancer poliment', "Politely follow up on a support request that hasn't been resolved."],
            ['Exiger une solution', 'Follow up on an unresolved issue, explain your frustration politely, and ask for a concrete solution.'],
        ],
        [
            SituationFixtures::SITUATION_LIBRARY_INFO_REFERENCE, 'W5-R7-S1', 'Librarian',
            ['Demander un livre', 'Ask a librarian to help you find a book.'],
            ['Rechercher une ressource précise', 'Ask a librarian for help finding a specific resource for a research topic.'],
        ],
        [
            SituationFixtures::SITUATION_BORROW_BOOK_REFERENCE, 'W5-R7-S2', 'Librarian',
            ['Emprunter un livre', 'Borrow a book and ask about the loan period.'],
            ['Se renseigner sur les modalités', 'Ask a librarian about renewal and late return policies before borrowing a book.'],
        ],

        [
            SituationFixtures::SITUATION_BANK_INFO_REFERENCE, 'W6-R1-S1', 'Bank Advisor',
            ['Se renseigner sur un compte', 'Ask a bank advisor about opening a bank account.'],
            ['Comparer des offres', 'Ask a bank advisor about different account options and compare their fees.'],
        ],
        [
            SituationFixtures::SITUATION_BANK_ISSUE_REFERENCE, 'W6-R1-S2', 'Bank Advisor',
            ['Signaler un problème simple', 'Tell a bank advisor about a problem with your card.'],
            ['Résoudre un problème', 'Explain a problem with your account in detail and ask the advisor to resolve it.'],
        ],
        [
            SituationFixtures::SITUATION_SEND_PACKAGE_REFERENCE, 'W6-R2-S1', 'Post Office Clerk',
            ['Envoyer un colis simple', 'Send a package at the post office.'],
            ["Comparer des options d'envoi", 'Ask about different shipping options and choose the best one for your package.'],
        ],
        [
            SituationFixtures::SITUATION_TRACK_SHIPMENT_REFERENCE, 'W6-R2-S2', 'Post Office Clerk',
            ['Se renseigner sur un envoi', 'Ask about the status of a shipment.'],
            ['Signaler un retard', 'Explain that a shipment is late and ask the clerk to look into it.'],
        ],
        [
            SituationFixtures::SITUATION_COMPARE_DEVICES_REFERENCE, 'W6-R3-S1', 'Shop Assistant',
            ['Comparer deux appareils simples', 'Ask a shop assistant to compare two devices.'],
            ['Demander conseil selon ses besoins', 'Describe your needs and ask a shop assistant to recommend the best device.'],
        ],
        [
            SituationFixtures::SITUATION_REPAIR_DEVICE_REFERENCE, 'W6-R3-S2', 'Shop Assistant',
            ['Signaler une panne', 'Tell a shop assistant your device is broken.'],
            ['Demander un devis de réparation', 'Explain the problem with your device in detail and ask for a repair quote and timeline.'],
        ],
        [
            SituationFixtures::SITUATION_EXPLAIN_CAR_ISSUE_REFERENCE, 'W6-R4-S1', 'Mechanic',
            ['Expliquer un problème simple', 'Explain a simple problem with your car to the mechanic.'],
            ['Décrire les symptômes en détail', "Describe your car's symptoms in detail to help the mechanic diagnose the problem."],
        ],
        [
            SituationFixtures::SITUATION_ASK_REPAIR_QUOTE_REFERENCE, 'W6-R4-S2', 'Mechanic',
            ['Demander un devis simple', 'Ask the mechanic for a simple repair quote.'],
            ['Négocier le délai et le prix', 'Ask about the repair cost and timeline, and negotiate if possible.'],
        ],
        [
            SituationFixtures::SITUATION_LOOK_FOR_APARTMENT_REFERENCE, 'W6-R5-S1', 'Real Estate Agent',
            ['Décrire ce qu\'on recherche', "Tell a real estate agent what kind of apartment you're looking for."],
            ['Préciser ses critères', 'Describe your budget and criteria in detail to a real estate agent.'],
        ],
        [
            SituationFixtures::SITUATION_ASK_LEASE_TERMS_REFERENCE, 'W6-R5-S2', 'Real Estate Agent',
            ['Poser une question simple', 'Ask the agent a simple question about a lease.'],
            ['Clarifier les conditions', 'Ask the agent detailed questions about lease terms and conditions.'],
        ],
        [
            SituationFixtures::SITUATION_ASK_VIEWING_QUESTIONS_REFERENCE, 'W6-R6-S1', 'Real Estate Agent',
            ['Poser des questions simples', 'Ask simple questions during an apartment viewing.'],
            ["Évaluer l'appartement", "Ask detailed questions about the apartment's condition and neighborhood during a viewing."],
        ],
        [
            SituationFixtures::SITUATION_NEGOTIATE_RENT_REFERENCE, 'W6-R6-S2', 'Real Estate Agent',
            ['Demander une réduction', 'Ask the agent if the rent is negotiable.'],
            ['Négocier les conditions', 'Negotiate the rent and move-in conditions with the agent.'],
        ],
        [
            SituationFixtures::SITUATION_REPORT_LOST_ITEM_REFERENCE, 'W6-R7-S1', 'Police Officer',
            ['Signaler un objet perdu', 'Report a lost item to a police officer.'],
            ["Décrire l'objet en détail", 'Describe a lost item in detail and fill out a report with the officer.'],
        ],
        [
            SituationFixtures::SITUATION_FILE_REPORT_REFERENCE, 'W6-R7-S2', 'Police Officer',
            ['Faire une déclaration simple', 'File a simple report about an incident.'],
            ['Raconter les faits en détail', 'Describe the incident in detail to a police officer while filing a report.'],
        ],
    ];

    public function load(ObjectManager $manager): void
    {
        foreach (self::MISSIONS as [$situationReference, $codePrefix, $characterName, $a1, $a2]) {
            /** @var Situation $situation */
            $situation = $this->getReference($situationReference, Situation::class);

            $this->createMission($manager, $situation, $codePrefix, 'A1', $characterName, $a1[0], $a1[1], 0);
            $this->createMission($manager, $situation, $codePrefix, 'A2', $characterName, $a2[0], $a2[1], 1);
        }

        $manager->flush();
    }

    private function createMission(
        ObjectManager $manager,
        Situation $situation,
        string $codePrefix,
        string $levelCode,
        string $characterName,
        string $title,
        string $objective,
        int $orderNum,
    ): void {
        /** @var Level $level */
        $level = $this->getReference(LevelFixtures::reference($levelCode), Level::class);
        $code = "{$codePrefix}-{$levelCode}";

        $mission = $manager->getRepository(Mission::class)->findOneBy(['code' => $code]) ?? new Mission();
        $mission
            ->setSituation($situation)
            ->setLevel($level)
            ->setCode($code)
            ->setTitle($title)
            ->setObjective($objective)
            ->setPromptTemplate(\sprintf(
                "You are %s, a character in an English conversation practice mission titled '%s' (situation: %s). ".
                "The learner is at CECRL level %s. Mission objective: %s. ".
                'Stay in character, speak only English, adapt your vocabulary and pace to the level, '.
                'and gently correct the learner when needed.',
                $characterName,
                $title,
                $situation->getTitle(),
                $levelCode,
                $objective,
            ))
            ->setCharacterName($characterName)
            ->setBaseXp(self::BASE_XP_BY_LEVEL[$levelCode])
            ->setOrderNum($orderNum);

        $manager->persist($mission);
    }

    public function getDependencies(): array
    {
        return [SituationFixtures::class, LevelFixtures::class];
    }
}
