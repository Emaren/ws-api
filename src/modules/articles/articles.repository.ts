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

export interface ArticlesRepository {
  list(): ArticleRecord[];
  create(params: CreateArticleParams): ArticleRecord;
  findBySlug(slug: string): ArticleRecord | undefined;
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
}
