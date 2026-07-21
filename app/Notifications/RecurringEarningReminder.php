<?php

namespace App\Notifications;

use App\Models\Earning;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class RecurringEarningReminder extends Notification
{
    use Queueable;

    public function __construct(private Earning $earning, private Carbon $dueAt) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Recurring earning due tomorrow')
            ->greeting('Hello!')
            ->line("Your recurring earning \"{$this->earning->description}\" is due tomorrow.")
            ->line('Amount: '.$this->earning->amount.' '.$this->earning->currency)
            ->line('Claim date: '.$this->dueAt->toFormattedDateString())
            ->action('Open earnings', route('earnings.index'));
    }
}
