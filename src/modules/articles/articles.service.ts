import { HttpError } from "../../shared/http-error.js";
import type { ArticleRecord, ArticleStatus } from "../../shared/models.js";
import type { ArticlesRepository } from "./articles.repository.js";

interface CreateArticleInput {
  title: string;
  content: string;
  excerpt: string;
  coverUrl: string;
  status: string;
  authorId: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export class ArticlesService {
  constructor(private readonly articlesRepository: ArticlesRepository) {}

  listArticles(): ArticleRecord[] {
    return this.articlesRepository.list();
  }

  createArticle(input: CreateArticleInput): ArticleRecord {
    if (!input.title.trim() || !input.content.trim()) {
      throw new HttpError(400, "Missing title or content");
    }

    const baseSlug = slugify(input.title) || "article";
    let slug = baseSlug;
    let suffix = 2;
    while (this.articlesRepository.findBySlug(slug)) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const status: ArticleStatus = input.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT";

    return this.articlesRepository.create({
      title: input.title.trim(),
      slug,
      content: input.content,
      excerpt: input.excerpt.trim() || null,
      coverUrl: input.coverUrl.trim() || null,
      status,
      authorId: input.authorId.trim() || null,
    });
  }
}
