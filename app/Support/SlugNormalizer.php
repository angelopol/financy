<?php

namespace App\Support;

use Illuminate\Support\Str;

class SlugNormalizer
{
    public static function normalize(array|string|null $value, ?string $fallback = null): string
    {
        $text = is_array($value) ? implode(' ', $value) : (string) $value;
        if (trim($text) === '' && $fallback !== null) {
            $text = $fallback;
        }

        $words = preg_split('/[^\pL\pN]+/u', Str::lower(Str::ascii($text)), -1, PREG_SPLIT_NO_EMPTY);

        return collect($words)
            ->filter(fn (string $word) => mb_strlen($word) >= 3)
            ->unique()
            ->values()
            ->implode(' ');
    }

    public static function words(array|string|null $value): array
    {
        $normalized = self::normalize($value);

        return $normalized === '' ? [] : explode(' ', $normalized);
    }
}
