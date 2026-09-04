<?php

namespace App\DataFixtures;

use App\Entity\QuizModule;
use App\Entity\QuizQuestion;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;

/**
 * The 6 vocabulary modules of the A0 voice quiz (TP §11, Jalon 4 §2.3):
 * salutations, chiffres, couleurs, famille, nourriture, objets.
 * 10 questions each, French prompt -> expected English answer.
 */
final class QuizFixtures extends Fixture
{
    private const MODULES = [
        ['M0-1', 'Salutations', [
            ['Comment dit-on "Bonjour" ?', 'hello'],
            ['Comment dit-on "Au revoir" ?', 'goodbye'],
            ['Comment dit-on "Merci" ?', 'thank you'],
            ['Comment dit-on "S\'il vous plaît" ?', 'please'],
            ['Comment dit-on "Bonne nuit" ?', 'good night'],
            ['Comment dit-on "Comment ça va ?" ?', 'how are you'],
            ['Comment dit-on "Enchanté" ?', 'nice to meet you'],
            ['Comment dit-on "À bientôt" ?', 'see you soon'],
            ['Comment dit-on "Excusez-moi" ?', 'excuse me'],
            ['Comment dit-on "Bonsoir" ?', 'good evening'],
        ]],
        ['M0-2', 'Chiffres', [
            ['Comment dit-on "un" ?', 'one'],
            ['Comment dit-on "deux" ?', 'two'],
            ['Comment dit-on "trois" ?', 'three'],
            ['Comment dit-on "quatre" ?', 'four'],
            ['Comment dit-on "cinq" ?', 'five'],
            ['Comment dit-on "dix" ?', 'ten'],
            ['Comment dit-on "vingt" ?', 'twenty'],
            ['Comment dit-on "cent" ?', 'one hundred'],
            ['Comment dit-on "zéro" ?', 'zero'],
            ['Comment dit-on "mille" ?', 'one thousand'],
        ]],
        ['M0-3', 'Couleurs', [
            ['Comment dit-on "rouge" ?', 'red'],
            ['Comment dit-on "bleu" ?', 'blue'],
            ['Comment dit-on "vert" ?', 'green'],
            ['Comment dit-on "jaune" ?', 'yellow'],
            ['Comment dit-on "noir" ?', 'black'],
            ['Comment dit-on "blanc" ?', 'white'],
            ['Comment dit-on "orange" ?', 'orange'],
            ['Comment dit-on "violet" ?', 'purple'],
            ['Comment dit-on "rose" ?', 'pink'],
            ['Comment dit-on "gris" ?', 'grey'],
        ]],
        ['M0-4', 'Famille', [
            ['Comment dit-on "mère" ?', 'mother'],
            ['Comment dit-on "père" ?', 'father'],
            ['Comment dit-on "frère" ?', 'brother'],
            ['Comment dit-on "sœur" ?', 'sister'],
            ['Comment dit-on "fille" ?', 'daughter'],
            ['Comment dit-on "fils" ?', 'son'],
            ['Comment dit-on "grand-mère" ?', 'grandmother'],
            ['Comment dit-on "grand-père" ?', 'grandfather'],
            ['Comment dit-on "cousin" ?', 'cousin'],
            ['Comment dit-on "enfant" ?', 'child'],
        ]],
        ['M0-5', 'Nourriture', [
            ['Comment dit-on "pain" ?', 'bread'],
            ['Comment dit-on "eau" ?', 'water'],
            ['Comment dit-on "pomme" ?', 'apple'],
            ['Comment dit-on "fromage" ?', 'cheese'],
            ['Comment dit-on "lait" ?', 'milk'],
            ['Comment dit-on "poisson" ?', 'fish'],
            ['Comment dit-on "viande" ?', 'meat'],
            ['Comment dit-on "légume" ?', 'vegetable'],
            ['Comment dit-on "fruit" ?', 'fruit'],
            ['Comment dit-on "œuf" ?', 'egg'],
        ]],
        ['M0-6', 'Objets', [
            ['Comment dit-on "table" ?', 'table'],
            ['Comment dit-on "chaise" ?', 'chair'],
            ['Comment dit-on "livre" ?', 'book'],
            ['Comment dit-on "porte" ?', 'door'],
            ['Comment dit-on "fenêtre" ?', 'window'],
            ['Comment dit-on "téléphone" ?', 'phone'],
            ['Comment dit-on "clé" ?', 'key'],
            ['Comment dit-on "sac" ?', 'bag'],
            ['Comment dit-on "montre" ?', 'watch'],
            ['Comment dit-on "lit" ?', 'bed'],
        ]],
    ];

    public function load(ObjectManager $manager): void
    {
        foreach (self::MODULES as $orderNum => [$code, $title, $questions]) {
            $module = (new QuizModule())
                ->setCode($code)
                ->setTitle($title)
                ->setOrderNum($orderNum)
                ->setQuestionCount(\count($questions));

            $manager->persist($module);

            foreach ($questions as $questionOrderNum => [$questionText, $correctAnswer]) {
                $question = (new QuizQuestion())
                    ->setModule($module)
                    ->setQuestionText($questionText)
                    ->setCorrectAnswer($correctAnswer)
                    ->setOrderNum($questionOrderNum);

                $manager->persist($question);
            }
        }

        $manager->flush();
    }
}
