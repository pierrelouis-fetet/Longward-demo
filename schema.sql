CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users(email);

-- ON UPDATE CASCADE n'est pas decoratif : une adresse peut revenir avec un
-- identifiant different si le compte est supprime puis recree chez le
-- fournisseur. La personne est la meme, son patrimoine doit la suivre. Sans la
-- cascade, reaffecter la ligne casserait la cle etrangere et laisserait un
-- patrimoine orphelin sous l'ancien identifiant.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS portfolios (
  owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  body TEXT NOT NULL,
  revision TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- LE COMPTEUR D'ABUS, ET POURQUOI IL VIT ICI PLUTOT QU'EN MEMOIRE.
--
-- Un Worker n'a pas de memoire entre deux requetes, et deux requetes voisines
-- ne tombent pas sur la meme instance : un compteur pose dans une variable ne
-- compte rien. La base est le seul endroit ou l'addition tient.
--
-- Une ligne par seau (`otp:ip:...`, `otp:mail:...`, `code:mail:...`), sa date
-- de remise a zero portee par la ligne elle-meme. Pas de tache de menage a
-- prevoir : un seau perime se reecrit au prochain passage, et les lignes
-- mortes se purgent a l'occasion d'une connexion.
CREATE TABLE IF NOT EXISTS auth_throttle (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_throttle_reset ON auth_throttle(reset_at);
