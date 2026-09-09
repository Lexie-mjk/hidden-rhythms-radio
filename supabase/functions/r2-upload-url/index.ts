// Signe une URL PUT de courte durée vers Cloudflare R2, pour que le panel admin puisse
// uploader un fichier directement (aucun octet ne transite par cette fonction — important
// pour des fichiers audio de plusieurs dizaines/centaines de Mo, largement au-dessus des
// limites de taille de requête d'une Edge Function). Réservé aux utilisateurs authentifiés
// (voir supabase/admin-access.sql pour le reste des droits admin).
//
// Déploiement : supabase functions deploy r2-upload-url
// Secrets requis :
//   supabase secrets set R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
//     R2_BUCKET_NAME=... R2_PUBLIC_URL_BASE=...

import { DeleteObjectCommand, PutObjectCommand, S3Client } from 'npm:@aws-sdk/client-s3@3';
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@^2/cors';

// Variables injectées automatiquement par Supabase dans toute Edge Function (pas besoin de
// les configurer via `supabase secrets set`). SUPABASE_SERVICE_ROLE_KEY est le nom historique ;
// SUPABASE_SECRET_KEYS (JSON) est le nouveau format — on gère les deux (même logique que
// soundcloud-proxy).
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

function r2Client(config: ReturnType<typeof getR2Config>) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    // cf. createUploadUrl ci-dessous : R2 rejette le checksum CRC32 ajouté par défaut par les
    // versions récentes du SDK.
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });
}

function getR2Config() {
  const accountId = Deno.env.get('R2_ACCOUNT_ID');
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
  const bucketName = Deno.env.get('R2_BUCKET_NAME');
  const publicUrlBase = Deno.env.get('R2_PUBLIC_URL_BASE');

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrlBase) {
    throw new Error(
      'Les secrets R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME et ' +
        'R2_PUBLIC_URL_BASE doivent être configurés (supabase secrets set).'
    );
  }
  return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrlBase };
}

async function requireAuthenticatedUser(req: Request): Promise<void> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) throw new AuthError();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new AuthError();
}

class AuthError extends Error {
  constructor() {
    super('Authentification requise.');
  }
}

async function createUploadUrl(path: string, contentType: string) {
  const config = getR2Config();
  const client = r2Client(config);
  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: path,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
  const publicUrl = `${config.publicUrlBase.replace(/\/$/, '')}/${path}`;
  return { uploadUrl, publicUrl };
}

// Supprime les objets R2 correspondant à des URLs publiques (renvoyées par createUploadUrl
// ci-dessus, stockées telles quelles en base). Les URLs hors de ce bucket sont ignorées :
// appelé depuis la suppression d'un set côté admin, mieux vaut ignorer une URL inattendue que
// faire échouer toute la suppression pour un fichier qu'on ne peut de toute façon pas nettoyer ici.
async function deleteObjectsByUrl(urls: string[]) {
  const config = getR2Config();
  const client = r2Client(config);
  const base = `${config.publicUrlBase.replace(/\/$/, '')}/`;

  await Promise.all(
    urls
      .filter((url) => url.startsWith(base))
      .map((url) => {
        const key = decodeURIComponent(url.slice(base.length));
        return client.send(new DeleteObjectCommand({ Bucket: config.bucketName, Key: key }));
      })
  );
}

export default {
  fetch: async (req: Request) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    try {
      await requireAuthenticatedUser(req);

      const body = await req.json();

      if (body.action === 'delete') {
        const urls: string[] = Array.isArray(body.urls) ? body.urls : [];
        await deleteObjectsByUrl(urls);
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      const { path, contentType } = body;
      if (!path) throw new Error('paramètre "path" manquant');

      const data = await createUploadUrl(path, contentType || 'application/octet-stream');
      return Response.json(data, { headers: corsHeaders });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = error instanceof AuthError ? 401 : 400;
      return Response.json({ error: message }, { status, headers: corsHeaders });
    }
  },
};
