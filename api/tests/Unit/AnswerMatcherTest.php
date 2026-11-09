<?php

namespace Tests\Unit;

use App\Services\AnswerMatcher;
use PHPUnit\Framework\TestCase;

class AnswerMatcherTest extends TestCase
{
    public function test_il_donne_le_resultat_attendu_sur_tous_les_cas_partages(): void
    {
        $file = dirname(__DIR__, 3).'/shared/answer-cases.json';
        $cases = json_decode((string) file_get_contents($file), true)['cases'];
        $matcher = new AnswerMatcher;
        $failures = [];

        foreach ($cases as $case) {
            $tolerance = $case['tolerance'] ?? 'normal';
            $result = $matcher->match($case['heard'], [$case['answer'], ...($case['aliases'] ?? [])], $case['lang'], $tolerance);
            if ($result !== $case['expected']) {
                $heard = is_array($case['heard']) ? implode(' / ', $case['heard']) : $case['heard'];
                $failures[] = "{$case['lang']} « {$case['answer']} » / « {$heard} » ({$tolerance}) : attendu {$case['expected']}, obtenu {$result}";
            }
        }

        $this->assertGreaterThanOrEqual(300, count($cases));
        $this->assertSame([], $failures);
    }

    public function test_il_retire_les_articles_mais_garde_un_mot_seul(): void
    {
        $matcher = new AnswerMatcher;

        $this->assertSame('pomme', $matcher->normalize("C'est une pomme !", 'fr'));
        $this->assertSame('de', $matcher->normalize('un dé', 'fr'));
        $this->assertSame('apple', $matcher->normalize("It's an Apple", 'en'));
    }
}
