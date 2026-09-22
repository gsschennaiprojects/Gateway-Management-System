import { NextRequest, NextResponse } from 'next/server';
import { findUserByIdentifier, stripSensitive } from '@/lib/auth/user-store';
import { setSessionCookie } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifier, password } = body;

    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json(
        { error: 'Please enter your Gmail address or 10-digit Mobile number' },
        { status: 400 }
      );
    }

    const user = findUserByIdentifier(identifier);

    if (!user) {
      return NextResponse.json(
        { error: 'No account found matching this Gmail or Mobile number' },
        { status: 401 }
      );
    }

    // In simple auth, if a password is provided, check it
    if (password && user.passwordHash && user.passwordHash !== password) {
      return NextResponse.json(
        { error: 'Invalid password. Please verify your password and try again.' },
        { status: 401 }
      );
    }

    const safeUser = stripSensitive(user);
    await setSessionCookie(safeUser);

    return NextResponse.json({
      success: true,
      user: safeUser
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Authentication failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
