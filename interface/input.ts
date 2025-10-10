export interface Root {
  forumDosen: string
  forumMahasiswa: ForumMahasiswa[]
  modeEmosi: string
  modeGayaBahasa: string
  bookSource: string
}

export interface ForumMahasiswa {
  id: string
  authorId: string
  authorfullName: string
  authorPictureUrl: string
  authorRole: string
  postDate: string
  postDateUtc: string
  commentText: string
  attachment: any
  quoteId: string
  quoteText: string
  quotePage: number
  repliesContinuousToken: any
  totalReply: number
  totalPreviousReply: number
  totalNextReply: number
  nextReply: boolean
  replies: any[]
  totalLike: number
  isLiked: boolean
  deletable: boolean
  editable: boolean
  flagCreditEarning: boolean
  creditEarningAttribute: any
}
