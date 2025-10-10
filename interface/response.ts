export interface Root {
  data: string
  metadata: Metadata
}

export interface Metadata {
  input: Input
  token: Token
}

export interface Input {
  forumDosen: string
  forumMahasiswa: ForumMahasiswa[]
  modeEmosi: string
  modeGayaBahasa: string
  bookSource: string
}

export interface ForumMahasiswa {
  authorFullName: string
  commentText: string
}

export interface Token {
  summaryForumCompletion: SummaryForumCompletion
  jawabanMahasiswaCompletion: JawabanMahasiswaCompletion
  relevansiCompletion: RelevansiCompletion
  responseJoin: ResponseJoin
  responseFinalCompletion: ResponseFinalCompletion
}

export interface SummaryForumCompletion {
  outputTokenCount: number
  inputTokenCount: number
  totalTokenCount: number
  outputTokenDetails: OutputTokenDetails
  inputTokenDetails: InputTokenDetails
}

export interface OutputTokenDetails {
  reasoningTokenCount: number
  audioTokenCount: number
  acceptedPredictionTokenCount: number
  rejectedPredictionTokenCount: number
}

export interface InputTokenDetails {
  audioTokenCount: number
  cachedTokenCount: number
}

export interface JawabanMahasiswaCompletion {
  outputTokenCount: number
  inputTokenCount: number
  totalTokenCount: number
  outputTokenDetails: OutputTokenDetails2
  inputTokenDetails: InputTokenDetails2
}

export interface OutputTokenDetails2 {
  reasoningTokenCount: number
  audioTokenCount: number
  acceptedPredictionTokenCount: number
  rejectedPredictionTokenCount: number
}

export interface InputTokenDetails2 {
  audioTokenCount: number
  cachedTokenCount: number
}

export interface RelevansiCompletion {
  outputTokenCount: number
  inputTokenCount: number
  totalTokenCount: number
  outputTokenDetails: OutputTokenDetails3
  inputTokenDetails: InputTokenDetails3
}

export interface OutputTokenDetails3 {
  reasoningTokenCount: number
  audioTokenCount: number
  acceptedPredictionTokenCount: number
  rejectedPredictionTokenCount: number
}

export interface InputTokenDetails3 {
  audioTokenCount: number
  cachedTokenCount: number
}

export interface ResponseJoin {
  outputTokenCount: number
  inputTokenCount: number
  totalTokenCount: number
  outputTokenDetails: OutputTokenDetails4
  inputTokenDetails: InputTokenDetails4
}

export interface OutputTokenDetails4 {
  reasoningTokenCount: number
  audioTokenCount: number
  acceptedPredictionTokenCount: number
  rejectedPredictionTokenCount: number
}

export interface InputTokenDetails4 {
  audioTokenCount: number
  cachedTokenCount: number
}

export interface ResponseFinalCompletion {
  outputTokenCount: number
  inputTokenCount: number
  totalTokenCount: number
  outputTokenDetails: OutputTokenDetails5
  inputTokenDetails: InputTokenDetails5
}

export interface OutputTokenDetails5 {
  reasoningTokenCount: number
  audioTokenCount: number
  acceptedPredictionTokenCount: number
  rejectedPredictionTokenCount: number
}

export interface InputTokenDetails5 {
  audioTokenCount: number
  cachedTokenCount: number
}
