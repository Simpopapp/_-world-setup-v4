// Esquema do banco de questões (um arquivo JSON por tipo em questions/<tipo>.json = array de Question).
// Cada texto é guardado UMA vez; o que for derivável (ex.: áudio TTS = transcript) não é duplicado.

export type Section = "speaking" | "writing" | "reading" | "listening";
export type TaskType =
  | "read_aloud"
  | "repeat_sentence"
  | "describe_image"
  | "retell_lecture"
  | "answer_short"
  | "sgd"
  | "rts"
  | "swt"
  | "write_essay"
  | "read_fib_dropdown"
  | "read_mcq_multi"
  | "reorder_paragraphs"
  | "read_fib_drag"
  | "read_mcq_single"
  | "sst"
  | "lst_mcq_multi"
  | "lst_fib"
  | "lst_hcs"
  | "lst_mcq_single"
  | "lst_smw"
  | "lst_hiw"
  | "wfd";

/** verificada = oficial ou pontuação de fonte >= 80 · corroborada = o mesmo item aparece em >= 2 fontes
 *  de operadores independentes · comunitaria = fonte de preparo com curadoria, sem corroboração. */
export type Provenance = "verificada" | "corroborada" | "comunitaria";

export interface SourceRef {
  id: string; // chave em sources/sources.json
  domain: string;
  url?: string;
  license?: string; // obrigatório em describe_image
  attribution?: string;
}
export interface QuestionBase {
  id: string; // estável e único; nunca reutilizado
  type: TaskType;
  topic?: string;
  source: SourceRef;
  provenance: Provenance;
  evidenceSummary?: string; // ex.: "confirmado por 3 fontes independentes"
}

export type QuestionData =
  | { text: string } // read_aloud
  | { transcript: string } // repeat_sentence
  | { image: string; alt: string; facts: string[]; keywords: string[] } // describe_image (image = "/di/<arquivo>.png" → images/describe_image/)
  | { transcript: string; keywords: string[]; sample: string } // retell_lecture · sst
  | { question: string; answers: string[] } // answer_short (respostas aceitas)
  | { turns: { speaker: string; text: string }[]; keywords: string[] } // sgd
  | { scenario: string } // rts
  | { text: string; keywords: string[]; sample: string } // swt
  | { prompt: string; sample?: string } // write_essay (sample em ~54% dos itens)
  | { passage: string; blanks: { options: string[]; answer: number }[] } // read_fib_dropdown ({{1}}, {{2}}…)
  | { passage: string; bank: string[]; answers: number[] } // read_fib_drag (answers[i] = índice em bank)
  | { passage: string; question: string; options: string[]; answer: number } // read_mcq_single
  | { passage: string; question: string; options: string[]; answer: number[] } // read_mcq_multi
  | { paragraphs: string[] } // reorder_paragraphs (ordem CORRETA; embaralhar em runtime)
  | { transcript: string; question: string; options: string[]; answer: number } // lst_mcq_single
  | { transcript: string; question: string; options: string[]; answer: number[] } // lst_mcq_multi
  | { template: string; answers: string[] } // lst_fib ({{n}}; transcript = template preenchido)
  | { transcript: string; options: string[]; answer: number } // lst_hcs · lst_smw (transcript termina onde o áudio para)
  | { spoken: string; shown: string } // lst_hiw (palavras erradas = diferença spoken × shown)
  | { sentence: string }; // wfd

export type Question = QuestionBase & { data: QuestionData };
