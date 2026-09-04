<?php

namespace App\Enum;

enum MessageRole: string
{
    case USER = 'user';
    case ASSISTANT = 'assistant';
}
