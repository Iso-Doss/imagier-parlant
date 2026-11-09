<?php

namespace App\Notifications;

use App\Models\AccountCode;
use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AccountCodeNotification extends Notification
{
    public function __construct(public string $code, public string $purpose) {}

    /** @return array<int, string> */
    public function via(User $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(User $notifiable): MailMessage
    {
        $reset = $this->purpose === AccountCode::RESET;

        return (new MailMessage)
            ->subject($reset ? __('Your code to choose a new password') : __('Your code to confirm your email'))
            ->greeting(__('Hello,'))
            ->line($reset
                ? __('Enter this code in the app to choose a new password:')
                : __('Enter this code in the app to confirm your email address:'))
            ->line('**'.$this->code.'**')
            ->line(__('The code is valid for :minutes minutes.', ['minutes' => 15]))
            ->line(__('If you did not ask for it, you can ignore this email.'))
            ->salutation(__('The Imagier parlant team'));
    }
}
