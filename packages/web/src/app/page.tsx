import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-50 to-white">
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">T</span>
          </div>
          <span className="font-semibold text-lg">TRACE</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link href="/login">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-100 text-brand-700 px-3 py-1 rounded-full text-sm font-medium mb-8">
          <span className="w-2 h-2 bg-brand-600 rounded-full"></span>
          EU Digital Product Passport compliant
        </div>
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 mb-6">
          Construction materials deserve
          <span className="text-brand-600"> a second life</span>
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
          TRACE issues blockchain-anchored material passports for reclaimed construction
          materials, enabling circular economy hubs to buy and sell with trust and compliance.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/login">
            <Button size="lg" className="bg-brand-600 hover:bg-brand-700">
              Register a material
            </Button>
          </Link>
          <Link href="/scan">
            <Button variant="outline" size="lg">
              Scan QR code
            </Button>
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: '🏗️',
              title: 'EU DPP Compliant',
              desc: 'Every passport follows EU Digital Product Passport standards, ready for 2027 regulation.',
            },
            {
              icon: '⛓️',
              title: 'Blockchain Anchored',
              desc: 'Integrity proofs on VeChainThor — anyone can verify a passport has not been tampered with.',
            },
            {
              icon: '♻️',
              title: 'Circular Economy',
              desc: 'Track deconstruction origin, condition grades, carbon savings, and reuse history.',
            },
          ].map((f) => (
            <div key={f.title} className="bg-white rounded-xl border p-6">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-gray-500 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
