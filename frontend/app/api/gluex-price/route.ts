import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("body", body)
    
    const glueXApiKey = process.env.NEXT_PUBLIC_GLUEX_API_KEY;
    const glueXUrl = process.env.NEXT_PUBLIC_GLUEX_URL || 'https://router.gluex.xyz';
    
    if (!glueXApiKey) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_GLUEX_API_KEY not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(`${glueXUrl}/v1/price`, {
      method: 'POST',
      headers: {
        'x-api-key': glueXApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('GlueX API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch price from GlueX' },
      { status: 500 }
    );
  }
}
