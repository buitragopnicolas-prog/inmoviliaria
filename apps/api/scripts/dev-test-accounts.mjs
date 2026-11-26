// Credentials enter the isolated test environment as password hashes only.
import pg from 'pg';

const profiles=[['admin','ADMIN','TENANT'],['cliente','USER','SERVICES'],['propietario','USER','OWNER']];
const dev=process.env.APP_ENV==='development' && process.env.WEB_ORIGIN==='https://dev.asesoriainmobiliariajb.com';
const local=process.env.APP_ENV==='local' && process.env.WEB_ORIGIN==='http://127.0.0.1:3127';
if (!dev && !local) throw Error('Entorno de pruebas no reconocido');
let input='';
for await(const chunk of process.stdin){input+=chunk;if(input.length>1024)throw Error('Solicitud demasiado larga');}
const request=JSON.parse(input);
if (!/^[a-f0-9]{12}$/.test(request.batch) || !profiles.every(([name])=>/^\$2[ab]\$12\$[./A-Za-z0-9]{53}$/.test(request[name])))throw Error('Lote de pruebas inválido');
const client=new pg.Client({connectionString:process.env.DATABASE_URL});
await client.connect();
try {
  await client.query('BEGIN');
  for(const [name,role,portal] of profiles){
    const id='jb-qa-'+request.batch+'-'+name;
    const email=name+'.'+request.batch+'@jb-pruebas.example';
    await client.query('INSERT INTO "User" (id,name,email,"passwordHash",role,portal,"updatedAt") VALUES ($1,$2,$3,$4,$5,$6,NOW()) ON CONFLICT DO NOTHING',
      [id,'Prueba JB '+name,email,request[name],role,portal]);
    const match=await client.query('SELECT id FROM "User" WHERE id=$1 AND email=$2 AND role=$3 AND portal=$4 AND "passwordHash"=$5',
      [id,email,role,portal,request[name]]);
    if(!match.rowCount)throw Error('El lote entra en conflicto con una cuenta existente');
  }
  await client.query('COMMIT');
  console.log('Tres cuentas de prueba verificadas.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {await client.end();}
