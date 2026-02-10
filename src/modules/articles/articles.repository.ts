import type { MemoryStore } from "../../infrastructure/memory/memory-store.js";
import { createId, nowIso } from "../../shared/ids.js";
import type { ArticleRecord, ArticleStatus } from "../../shared/models.js";

export interface CreateArticleParams {
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  coverUrl: string | null;
  status: ArticleStatus;
  authorId: string | null;
}

export interface UpdateArticleParams {
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string | null;
  coverUrl?: string | null;
  status?: ArticleStatus;
  publishedAt?: string | null;
}

export interface ArticlesRepository {
  list(): ArticleRecord[];
  create(params: CreateArticleParams): ArticleRecord;
  findBySlug(slug: string): ArticleRecord | undefined;
  updateBySlug(slug: string, params: UpdateArticleParams): ArticleRecord | undefined;
  deleteBySlug(slug: string): boolean;
}

export class InMemoryArticlesRepository implements ArticlesRepository {
  constructor(private readonly store: MemoryStore) {}

  list(): ArticleRecord[] {
    return [...this.store.articles];
  }

  create(params: CreateArticleParams): ArticleRecord {
    const timestamp = nowIso();
    const article: ArticleRecord = {
      id: createId("art"),
      title: params.title,
      slug: params.slug,
      content: params.content,
      excerpt: params.excerpt,
      coverUrl: params.coverUrl,
      status: params.status,
      authorId: params.authorId,
      publishedAt: params.status === "PUBLISHED" ? timestamp : null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.store.articles.push(article);
    return article;
  }

  findBySlug(slug: string): ArticleRecord | undefined {
    return this.store.articles.find((article) => article.slug === slug);
  }

  updateBySlug(slug: string, params: UpdateArticleParams): ArticleRecord | undefined {
    const index = this.store.articles.findIndex((article) => article.slug === slug);
    if (index === -1) {
      return undefined;
    }

    const existing = this.store.articles[index];
    if (!existing) {
      return undefined;
    }

    const updated: ArticleRecord = {
      ...existing,
      ...(params.title !== undefined ? { title: params.title } : {}),
      ...(params.slug !== undefined ? { slug: params.slug } : {}),
      ...(params.content !== undefined ? { content: params.content } : {}),
      ...(params.excerpt !== undefined ? { excerpt: params.excerpt } : {}),
      ...(params.coverUrl !== undefined ? { coverUrl: params.coverUrl } : {}),
      ...(params.status !== undefined ? { status: params.status } : {}),
      ...(params.publishedAt !== undefined ? { publishedAt: params.publishedAt } : {}),
      updatedAt: nowIso(),
    };

    this.store.articles[index] = updated;
    return updated;
  }

  deleteBySlug(slug: string): boolean {
    const index = this.store.articles.findIndex((article) => article.slug === slug);
    if (index === -1) {
      return false;
    }

    this.store.articles.splice(index, 1);
    return true;
  }
}
