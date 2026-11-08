<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property Carbon $started_at
 * @property Carbon|null $ended_at
 */
#[Fillable(['id', 'locale', 'mode', 'categories', 'count', 'started_at', 'ended_at'])]
class PlaySession extends Model
{
    use HasUuids;

    public const MODES = ['voice', 'parent', 'watch'];

    protected function casts(): array
    {
        return ['categories' => 'array', 'started_at' => 'datetime', 'ended_at' => 'datetime', 'count' => 'integer'];
    }

    /** @return BelongsTo<ChildProfile, $this> */
    public function profile(): BelongsTo
    {
        return $this->belongsTo(ChildProfile::class, 'child_profile_id');
    }

    /** @return HasMany<Answer, $this> */
    public function answers(): HasMany
    {
        return $this->hasMany(Answer::class)->orderBy('position');
    }
}
