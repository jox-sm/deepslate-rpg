//extensions

CREATE TABLE IF NOT EXISTS games (

  id UUID PRIMARY KEY NOT NULL,
    
    name TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0,
    description TEXT,
    
    image TEXT NOT NULL,
    
    tags TEXT[] DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_games_tags ON games USING GIN (tags);

CREATE INDEX idx_games_name ON games (name);