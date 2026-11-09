<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['item_id', 'box', 'correct_count', 'wrong_count', 'last_result', 'last_seen_at', 'next_due_at'])]
class ItemProgress extends Model
{
    protected $table = 'item_progress';

    public $timestamps = false;

    protected function casts(): array
    {
        return ['last_seen_at' => 'datetime', 'next_due_at' => 'datetime', 'box' => 'integer'];
    }

    /** @return BelongsTo<Item, $this> */
    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }
}
