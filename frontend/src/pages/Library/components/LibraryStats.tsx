// import React from 'react'
import { Book, User, Tag, Star } from 'lucide-react'
import { Card, CardContent } from '../../../components/ui/card'
import type { LibraryStats as LibraryStatsType } from '../types'

interface LibraryStatsProps {
  stats: LibraryStatsType
}

export function LibraryStats({ stats }: LibraryStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Books</p>
              <p className="text-2xl font-bold">{stats.total_books.toLocaleString()}</p>
            </div>
            <Book className="h-8 w-8 text-blue-600" />
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Authors</p>
              <p className="text-2xl font-bold">{stats.total_authors.toLocaleString()}</p>
            </div>
            <User className="h-8 w-8 text-green-600" />
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Series</p>
              <p className="text-2xl font-bold">{stats.total_series.toLocaleString()}</p>
            </div>
            <Star className="h-8 w-8 text-purple-600" />
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Tags</p>
              <p className="text-2xl font-bold">{stats.total_tags.toLocaleString()}</p>
            </div>
            <Tag className="h-8 w-8 text-orange-600" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
