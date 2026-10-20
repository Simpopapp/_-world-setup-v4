// Loader dinâmico do banco: um import por tipo (code-splitting), cache em memória.
// O bundle nunca carrega o banco inteiro de uma vez; cada tipo é um chunk JSON.
import type { Question, TaskType } from "@/domain/types";

type QuestionModule = { default: Question[] };

const modules = import.meta.glob<QuestionModule>("@/data/questions/*.json");

/** Chave absoluta usada pelo import.meta.glob para o arquivo de um tipo. */
function keyFor(type: TaskType): string {
  return `/src/data/questions/${type}.json`;
}

const cache = new Map<TaskType, Promise<Question[]>>();

/** Carrega (uma vez por sessão) o array de questões de um tipo. */
export function loadQuestions(type: TaskType): Promise<Question[]> {
  const cached = cache.get(type);
  if (cached) return cached;
  const loader = modules[keyFor(type)];
  if (!loader) return Promise.reject(new Error(`arquivo de questões ausente para ${type}`));
  const promise = loader().then((m) => m.default ?? []);
  cache.set(type, promise);
  return promise;
}

/** aliases.json = { id descartado: id canônido... } — protege contra colisões futuras de ids. */
let aliasesPromise: Promise<Record<string, string>> | null = null;

export function loadAliases(): Promise<Record<string, string>> {
  if (!aliasesPromise) {
    const entry = Object.entries(modules).find(([path]) => path.endsWith("/aliases.json"));
    const promise = entry
      ? entry[1]().then((m) => (m.default ?? {}) as unknown as Record<string, string>)
      : Promise.resolve({});
    aliasesPromise = promise;
    return promise;
  }
  return aliasesPromise;
}

/** canonicalId resolve um id descartado para o id canônico (quase-duplicatas não dividem estatística). */
export async function canonicalIdOf(questionId: string): Promise<string> {
  const aliases = await loadAliases();
  return aliases[questionId] ?? questionId;
}

/** Tipos com arquivo presente no glob (uso interno/atestado do catálogo). */
export function availableQuestionFiles(): string[] {
  return Object.keys(modules)
    .filter((p) => !p.endsWith("/aliases.json"))
    .sort();
}
