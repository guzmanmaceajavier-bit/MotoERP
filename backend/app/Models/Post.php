<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Post extends Model
{
    protected $fillable = ['title', 'slug', 'excerpt', 'content', 'cover', 'is_published', 'published_at', 'user_id'];

    protected $casts = [
        'is_published' => 'boolean',
        'published_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function ($post) {
            $post->slug = $post->slug ?: Str::slug($post->title);
        });
    }

    public function author()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function excerptText(int $len = 160): string
    {
        return $this->excerpt ?: Str::limit(strip_tags($this->content), $len);
    }
}