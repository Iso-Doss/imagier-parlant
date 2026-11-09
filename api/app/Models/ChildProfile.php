<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Profil enfant : surnom, avatar et tranche d'âge seulement. */
#[Fillable(['nickname', 'avatar', 'age_band', 'locale', 'settings'])]
class ChildProfile extends Model
{
    use HasUuids;

    public const MAX_PER_ACCOUNT = 6;

    public const AGE_BANDS = ['2-3', '4-5', '6-7'];

    public const AVATARS = ['ours', 'lapin', 'chat', 'chien', 'renard', 'hibou', 'lion', 'panda', 'grenouille', 'baleine', 'tortue', 'licorne'];

    protected function casts(): array
    {
        return ['settings' => 'array'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<PlaySession, $this> */
    public function sessions(): HasMany
    {
        return $this->hasMany(PlaySession::class);
    }

    /** @return HasMany<ItemProgress, $this> */
    public function progress(): HasMany
    {
        return $this->hasMany(ItemProgress::class);
    }
}
