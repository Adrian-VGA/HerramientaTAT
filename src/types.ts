export type Coordinates = {
  latitude: number
  longitude: number
  accuracy?: number
}

export type VisitStatus = 'pending' | 'visited'

export type Client = {
  id: string
  code: string
  name: string
  coordinates: Coordinates
  createdAt: string
  neighborhood?: string
  visitStatus?: VisitStatus
  lastVisitAt?: string
  notes?: string
}

export type Visit = {
  id: string
  clientId: string
  createdAt: string
  coordinates?: Coordinates
}

export type ClientRepository = {
  list(): Client[]
  create(client: Client): void
  update(client: Client): void
  remove(id: string): void
}
