import { NextRequest, NextResponse } from 'next/server';
import { createUser, stripSensitive } from '@/lib/auth/user-store';
import { setSessionCookie } from '@/lib/auth/session';
import { RegisterPayload, BRANCHES, SPECIALIZATIONS } from '@/types/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      email,
      mobile,
      requestedRole,
      branch,
      specialization,
      specializations,
      startMonthYear,
      startDate,
      endDate,
      password
    } = body as RegisterPayload;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    }

    if (!email?.trim() || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    const cleanMobile = mobile?.replace(/\D/g, '');
    if (!cleanMobile || cleanMobile.length < 10) {
      return NextResponse.json({ error: 'Valid 10-digit mobile number is required' }, { status: 400 });
    }

    if (!branch || !BRANCHES.includes(branch)) {
      return NextResponse.json(
        { error: 'Please select a valid branch (Coimbatore, Chennai, Madurai, or Erode)' },
        { status: 400 }
      );
    }

    const domainsList = Array.isArray(specializations) && specializations.length > 0
      ? specializations
      : specialization?.trim()
      ? [specialization.trim()]
      : [];

    if (domainsList.length === 0) {
      return NextResponse.json(
        { error: 'Please select or type at least one domain specialization' },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const newUser = createUser({
      name,
      email,
      mobile: cleanMobile,
      requestedRole: requestedRole || 'intern',
      branch,
      specialization: domainsList.join(', '),
      specializations: domainsList,
      startMonthYear: startMonthYear || new Date().toISOString().substring(0, 7),
      startDate,
      endDate,
      password
    });

    const safeUser = stripSensitive(newUser);
    // Set session cookie with the new user in 'pending' status
    await setSessionCookie(safeUser);

    return NextResponse.json({
      success: true,
      message: 'Your account has been registered and is pending approval.',
      user: safeUser
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
