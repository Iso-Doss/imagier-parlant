<?php

declare(strict_types=1);

namespace App\Services;

use Normalizer;

/**
 * Compare ce que l'enfant a dit avec le nom attendu.
 *
 * Même algorithme que mobile/src/lib/answerMatcher.ts et le prototype web :
 * les trois sont testés sur shared/answer-cases.json.
 */
class AnswerMatcher
{
    public const TOLERANCES = ['strict', 'normal', 'lenient'];

    private const PHRASES = [
        'fr' => ['est ce que c est', 'est ce que', 'c est', 'ce sont', 'ca c est', 'ca', 'voila', 'je crois que', 'je pense que', 'il y a'],
        'en' => ['is it', 'it is', 'it s', 'its', 'this is', 'that is', 'that s', 'thats', 'i think', 'there is', 'there s'],
    ];

    private const WORDS = [
        'fr' => ['le', 'la', 'les', 'l', 'un', 'une', 'des', 'du', 'de', 'd', 'au', 'aux', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes',
            'son', 'sa', 'ses', 'ce', 'cet', 'cette', 'ces', 'euh', 'heu', 'hum', 'bah', 'ben', 'oh', 'ah', 'et'],
        'en' => ['the', 'a', 'an', 'my', 'your', 'this', 'that', 'some', 'um', 'uh', 'er', 'oh', 'ah', 'and'],
    ];

    private const FR_RULES = [
        ['/ph/', 'f'],
        ['/sch|ch|sh/', 'S'],
        ['/h/', ''],
        ['/eaux?/', 'o'],
        ['/au/', 'o'],
        ['/qu/', 'k'],
        ['/q/', 'k'],
        ['/gu([eiy])/', 'g$1'],
        ['/ge([aou])/', 'j$1'],
        ['/g([eiy])/', 'j$1'],
        ['/c([eiy])/', 's$1'],
        ['/c/', 'k'],
        ['/gn/', 'N'],
        ['/ou/', 'U'],
        ['/oi/', 'WA'],
        ['/(ai|ei)n(?![aeiouy])/', 'E'],
        ['/(ai|ei)m(?![aeiouy])/', 'E'],
        ['/[ae]n(?![aeiouyn])|[ae]m(?![aeiouym])/', 'A'],
        ['/on(?![aeiouyn])|om(?![aeiouym])/', 'O'],
        ['/(in|yn|un)(?![aeiouyn])|(im|ym|um)(?![aeiouym])/', 'E'],
        ['/ai|ei/', 'E'],
        ['/(er|et)$/', 'E'],
        ['/y/', 'i'],
        ['/w/', 'v'],
        ['/x$/', ''],
        ['/([aeiouAEOUi])s(?=[aeiouAEOUi])/', '$1z'],
        ['/(.)\1+/', '$1'],
        ['/[sxtdpe]+$/', ''],
        ['/S/', 's'],
        ['/E/', 'e'],
    ];

    private const EN_RULES = [
        ['/^kn/', 'n'],
        ['/^wr/', 'r'],
        ['/^ps/', 's'],
        ['/mb$/', 'm'],
        ['/ph/', 'f'],
        ['/aw|au/', 'o'],
        ['/gh(?![aeiou])/', ''],
        ['/ck/', 'k'],
        ['/sch/', 'sk'],
        ['/tch|ch|sh/', 'S'],
        ['/th/', '0'],
        ['/dg/', 'j'],
        ['/c([eiy])/', 's$1'],
        ['/c|q/', 'k'],
        ['/g([eiy])/', 'j$1'],
        ['/x/', 'ks'],
        ['/z/', 's'],
        ['/ee|ea/', 'i'],
        ['/oo/', 'u'],
        ['/y/', 'i'],
        ['/([^aeiou])h/', '$1'],
        ['/(.)\1+/', '$1'],
        ['/(e?s)$/', ''],
        ['/(.)e$/', '$1'],
    ];

    /** Substitutions courantes de la première lettre chez l'enfant (entendu + attendu). */
    private const SOFT_FIRST = ['zg', 'zj', 'sc', 'kg', 'kc', 'ck', 'wr', 'fp'];

    public function normalize(string $text, string $lang): string
    {
        $base = strtolower(substr($lang, 0, 2));
        $s = mb_strtolower($text);
        $s = (string) preg_replace('/\p{Mn}/u', '', (string) Normalizer::normalize($s, Normalizer::FORM_D));
        $s = str_replace(['œ', 'æ'], ['oe', 'ae'], $s);
        $s = ' '.(string) preg_replace('/[^a-z0-9]+/', ' ', $s).' ';
        foreach (self::PHRASES[$base] ?? [] as $phrase) {
            $s = str_replace(" {$phrase} ", ' ', $s);
        }

        $skip = self::WORDS[$base] ?? [];
        $words = array_values(array_filter(explode(' ', $s), fn (string $w): bool => $w !== ''));
        $kept = [];
        foreach ($words as $i => $word) {
            // Un article n'est retiré que s'il est suivi d'un autre mot (« un dé » garde « de »).
            $onlyStopWords = $kept === [] && $i === count($words) - 1;
            if (! in_array($word, $skip, true) || $onlyStopWords) {
                $kept[] = $word;
            }
        }

        return implode(' ', $kept);
    }

    public function phonetic(string $word, string $lang): string
    {
        $rules = strtolower(substr($lang, 0, 2)) === 'en' ? self::EN_RULES : self::FR_RULES;
        $s = str_replace(' ', '', $word);
        foreach ($rules as [$pattern, $replacement]) {
            $s = (string) preg_replace($pattern, $replacement, $s);
        }

        return $s;
    }

    /**
     * @param  string|list<string>  $heard  une ou plusieurs transcriptions de la reconnaissance vocale
     * @param  list<string>  $forms  le nom attendu et ses variantes acceptées
     * @return 'correct'|'close'|'wrong'
     */
    public function match(string|array $heard, array $forms, string $lang, string $tolerance = 'normal'): string
    {
        $candidates = array_filter(array_map(fn (string $h) => $this->normalize($h, $lang), (array) $heard), fn ($h) => $h !== '');
        $targets = array_unique(array_filter(array_map(fn (string $f) => $this->normalize($f, $lang), $forms), fn ($f) => $f !== ''));
        $close = false;

        foreach ($targets as $target) {
            $compact = str_replace(' ', '', $target);
            $limit = $this->threshold($compact, $tolerance);
            $key = $this->phonetic($compact, $lang);

            foreach ($candidates as $candidate) {
                foreach ($this->windows(explode(' ', $candidate), count(explode(' ', $target))) as $piece) {
                    if ($piece === $compact) {
                        return 'correct';
                    }
                    if ($tolerance === 'strict') {
                        continue;
                    }
                    $distance = levenshtein($piece, $compact) + $this->firstLetterPenalty($piece, $compact);
                    $sound = $this->phonetic($piece, $lang);
                    if (strlen($key) >= 2 && $sound === $key) {
                        return 'correct';
                    }
                    // Au-delà d'une lettre d'écart, il faut aussi que les deux mots sonnent presque pareil.
                    if ($distance <= min($limit, 1)) {
                        return 'correct';
                    }
                    if ($distance <= $limit && levenshtein($sound, $key) <= ($tolerance === 'lenient' ? 2 : 1)) {
                        return 'correct';
                    }
                    if ($distance <= $limit + 1 && $distance / strlen($compact) <= 0.34) {
                        $close = true;
                    }
                }
            }
        }

        return $close ? 'close' : 'wrong';
    }

    private function threshold(string $compact, string $tolerance): int
    {
        if ($tolerance === 'strict') {
            return 0;
        }
        $len = strlen($compact);
        $base = $len <= 3 ? 0 : ($len <= 5 ? 1 : 2);

        return $tolerance === 'lenient' ? $base + 1 : $base;
    }

    /**
     * Une autre première lettre change souvent le mot (« gâteau » / « bateau ») : 2 points de plus,
     * sauf si l'enfant a avalé le début (« apin » / « lapin ») ou fait une substitution courante.
     */
    private function firstLetterPenalty(string $heard, string $target): int
    {
        if ($heard[0] === $target[0] || in_array($heard[0].$target[0], self::SOFT_FIRST, true)) {
            return 0;
        }
        if (strlen($heard) < strlen($target) && str_contains(substr($target, 1, 2), $heard[0])) {
            return 0;
        }

        return 2;
    }

    /**
     * Les morceaux de la phrase dite (mots collés) qui peuvent correspondre à une forme de $size mots.
     *
     * @param  list<string>  $heard
     * @return list<string>
     */
    private function windows(array $heard, int $size): array
    {
        $out = [];
        for ($n = 1; $n <= min($size + 1, count($heard)); $n++) {
            for ($i = 0; $i + $n <= count($heard); $i++) {
                $out[] = implode('', array_slice($heard, $i, $n));
            }
        }

        return $out;
    }
}
