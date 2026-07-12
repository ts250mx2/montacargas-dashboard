import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { serialize } from 'cookie';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    const [rows] = await pool.query(
      'SELECT id, nombre, login FROM usuarios WHERE login = ? AND password = ? AND activo = 1',
      [username, password]
    );
    const users = rows as any[];

    if (users.length === 0) {
      return NextResponse.json({ message: 'Credenciales inválidas' }, { status: 401 });
    }

    const user = users[0];
    const cookie = serialize('auth_session', JSON.stringify({ id: user.id, login: user.login }), {
      httpOnly: true,
      secure: false, // permitir acceso por IP sin SSL
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 1 semana
      path: '/',
    });

    const response = NextResponse.json({ success: true, user });
    response.headers.set('Set-Cookie', cookie);
    return response;
  } catch (error: any) {
    console.error('Error en login:', error.message);
    return NextResponse.json(
      { message: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}
