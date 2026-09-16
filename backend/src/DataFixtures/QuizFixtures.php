<?php

namespace App\DataFixtures;

use App\Entity\QuizModule;
use App\Entity\QuizQuestion;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;

/**
 * The 6 vocabulary modules of the A0 voice quiz (TP §11, Jalon 4 §2.3):
 * greetings, numbers, colors, family, food, objects.
 * 10 questions each - all-English clue -> expected English answer (no
 * French prompt to translate; the clue is worded so it never contains the
 * answer word itself, since TTS would otherwise give it away by reading it
 * aloud - e.g. numbers are asked via arithmetic/counting clues rather than
 * "what is the English word for 5", which TTS would just read as "five").
 */
final class QuizFixtures extends Fixture
{
    private const MODULES = [
        ['M0-1', 'Greetings', [
            ['What do you say when you meet someone?', 'hello'],
            ['What do you say when you leave someone?', 'goodbye'],
            ['What do you say when someone helps you?', 'thank you'],
            ['What word makes a request sound polite?', 'please'],
            ['What do you say to someone before they go to sleep?', 'good night'],
            ['What do you ask to find out if someone feels well?', 'how are you'],
            ['What do you say the first time you meet someone?', 'nice to meet you'],
            ['What do you say when you will see someone again soon?', 'see you soon'],
            ['What do you say to politely get someone\'s attention?', 'excuse me'],
            ['What do you say when you greet someone in the evening?', 'good evening'],
        ]],
        ['M0-2', 'Numbers', [
            ['What number comes after zero?', 'one'],
            ['What number comes after one?', 'two'],
            ['What number comes after two?', 'three'],
            ['What number comes after three?', 'four'],
            ['How many fingers are on one hand?', 'five'],
            ['How many fingers are on two hands?', 'ten'],
            ['What number is double ten?', 'twenty'],
            ['What number is ten times ten?', 'one hundred'],
            ['What number means nothing at all?', 'zero'],
            ['What number is ten times one hundred?', 'one thousand'],
        ]],
        ['M0-3', 'Colors', [
            ['What color is blood?', 'red'],
            ['What color is a clear sky?', 'blue'],
            ['What color is grass?', 'green'],
            ['What color is a banana?', 'yellow'],
            ['What color is coal?', 'black'],
            ['What color is snow?', 'white'],
            ['What color do you get by mixing red and yellow?', 'orange'],
            ['What color do you get by mixing red and blue?', 'purple'],
            ['What color do you get by mixing red and white?', 'pink'],
            ['What color is a cloudy sky?', 'grey'],
        ]],
        ['M0-4', 'Family', [
            ['What do you call a female parent?', 'mother'],
            ['What do you call a male parent?', 'father'],
            ['What do you call a male sibling?', 'brother'],
            ['What do you call a female sibling?', 'sister'],
            ['What do you call a female child?', 'daughter'],
            ['What do you call a male child?', 'son'],
            ['What do you call the mother of your mother or father?', 'grandmother'],
            ['What do you call the father of your mother or father?', 'grandfather'],
            ['What do you call the child of your aunt or uncle?', 'cousin'],
            ['What do you call a young person, whether a boy or a girl?', 'child'],
        ]],
        ['M0-5', 'Food', [
            ['What food is made from flour and baked in an oven?', 'bread'],
            ['What do you drink when you are thirsty?', 'water'],
            ['What round fruit can be red or green and grows on a tree?', 'apple'],
            ['What food is made from milk and often used on pizza?', 'cheese'],
            ['What white drink comes from a cow?', 'milk'],
            ['What animal lives in water and has fins?', 'fish'],
            ['What food comes from an animal, like beef or chicken?', 'meat'],
            ['What do you call food like carrots or potatoes?', 'vegetable'],
            ['What do you call food like apples or bananas?', 'fruit'],
            ['What oval food comes from a chicken?', 'egg'],
        ]],
        ['M0-6', 'Objects', [
            ['What piece of furniture do you eat your meals on?', 'table'],
            ['What piece of furniture do you sit on?', 'chair'],
            ['What object has pages with words or pictures to read?', 'book'],
            ['What do you open to enter a room?', 'door'],
            ['What do you look through to see outside?', 'window'],
            ['What device do you use to call someone?', 'phone'],
            ['What small metal object opens a lock?', 'key'],
            ['What object do you carry your things in?', 'bag'],
            ['What object do you wear on your wrist to tell the time?', 'watch'],
            ['What piece of furniture do you sleep on?', 'bed'],
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
