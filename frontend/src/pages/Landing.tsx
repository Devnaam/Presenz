import React from 'react';
import { Link } from 'react-router-dom';

const Landing: React.FC = () => {
  return (
    <>
      <style>{css}</style>

      {/* NAV */}
      <nav>
        <div className="lp-container lp-nav-inner">
          <Link to="/" className="lp-nav-logo">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-label="Presenz logo">
              <rect width="28" height="28" rx="8" fill="currentColor" />
              <path d="M7 14C7 14 9 9 14 9C19 9 21 14 21 14C21 14 19 19 14 19C9 19 7 14 7 14Z" stroke="white" strokeWidth="2" fill="none" />
              <circle cx="14" cy="14" r="3" fill="white" />
            </svg>
            Presenz
          </Link>
          <div className="lp-nav-links">
            <a href="#how-it-works">How it works</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div className="lp-nav-cta">
            <Link to="/login" className="lp-btn lp-btn-secondary lp-nav-login">Log in</Link>
            <Link to="/register" className="lp-btn lp-btn-primary">Get started free</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="lp-hero">
        <div className="lp-container">
          <div className="lp-hero-inner">
            <div>
              <div className="lp-hero-tag">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><circle cx="6" cy="6" r="6" /></svg>
                AI WhatsApp Assistant
              </div>
              <h1>Your AI replies<br />while you <em>focus</em></h1>
              <p className="lp-hero-sub">
                Presenz keeps your family close even when you're busy.
                AI replies to WhatsApp messages in your voice — casual, natural, just like you.
              </p>
              <div className="lp-hero-actions">
                <Link to="/register" className="lp-btn lp-btn-primary lp-btn-lg">
                  Start for free
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </Link>
                <a href="#how-it-works" className="lp-btn lp-btn-secondary lp-btn-lg">See how it works</a>
              </div>
              <div className="lp-hero-trust">
                <div style={{ display: 'flex' }}>
                  {['R', 'A', 'P'].map((l, i) => (
                    <div key={l} className="lp-trust-avatar" style={{ marginLeft: i > 0 ? '-8px' : 0, background: ['#0d7a5f', '#e67e22', '#8e44ad'][i] }}>{l}</div>
                  ))}
                </div>
                <p className="lp-hero-trust-text">Trusted by students &amp; professionals across India</p>
              </div>
            </div>

            {/* Phone Mockup */}
            <div className="lp-hero-visual">
              <div className="lp-float-badge">
                <div className="lp-float-dot"></div>
                AI replied · just now
              </div>
              <div className="lp-phone-mockup">
                <div className="lp-phone-screen">
                  <div className="lp-phone-header">
                    <div className="lp-phone-avatar">M</div>
                    <div>
                      <div className="lp-phone-contact-name">Mom</div>
                      <div className="lp-phone-contact-status">online</div>
                    </div>
                  </div>
                  <div className="lp-phone-messages">
                    <div className="lp-msg lp-msg-in">
                      Beta kha liya? Aaj exam kaisa gaya?
                      <div className="lp-msg-time">3:42 PM</div>
                    </div>
                    <div className="lp-typing">
                      <div className="lp-dot"></div>
                      <div className="lp-dot"></div>
                      <div className="lp-dot"></div>
                    </div>
                    <div className="lp-msg lp-msg-out">
                      Haan ma kha liya 😊 exam tha thoda tough but theek tha. Aaj raat baat karte hain!
                      <div className="lp-msg-time">3:43 PM</div>
                      <div className="lp-ai-badge">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                        AI replied
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <div className="lp-social-proof">
        <div className="lp-container">
          <p className="lp-social-proof-label">Built for India's students &amp; working professionals</p>
          <div className="lp-social-proof-numbers">
            {[
              { num: '10k+', label: 'AI replies sent' },
              { num: '98%', label: 'Replies sound natural' },
              { num: 'Hinglish', label: 'Natively supported' },
              { num: '3 min', label: 'Setup time' },
            ].map((s) => (
              <div key={s.num} className="lp-stat-item">
                <div className="lp-stat-num">{s.num}</div>
                <div className="lp-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section className="lp-section" id="how-it-works">
        <div className="lp-container">
          <p className="lp-section-label">How it works</p>
          <h2 className="lp-section-title">Set up in 3 steps,<br />then forget about it</h2>
          <p className="lp-section-sub">Presenz works silently in the background — your family always gets a reply.</p>
          <div className="lp-steps-grid">
            {[
              { n: '01', title: 'Connect WhatsApp', desc: 'Scan a QR code to link your account. Takes under 60 seconds — no app download, no number porting.' },
              { n: '02', title: 'Add contacts & build your profile', desc: 'Tell Presenz who to reply to and write a short "about me." The more context, the more natural the AI sounds.' },
              { n: '03', title: 'Go Away, stay present', desc: 'Switch to Away before a lecture or exam. AI handles every message in your voice until you\'re back.' },
            ].map((s) => (
              <div key={s.n} className="lp-step-card">
                <div className="lp-step-number">{s.n}</div>
                <h3 className="lp-step-title">{s.title}</h3>
                <p className="lp-step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="lp-features-section" id="features">
        <div className="lp-container">
          <p className="lp-section-label">Features</p>
          <h2 className="lp-section-title">Everything your AI<br />needs to sound like you</h2>
          <div className="lp-features-grid">
            <div className="lp-feature-card lp-feature-wide">
              <div>
                <div className="lp-feature-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4" /><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" /></svg>
                </div>
                <h3 className="lp-feature-title">About Me — AI learns your style</h3>
                <p className="lp-feature-desc">Write a few sentences about yourself. Presenz uses this to generate replies that genuinely sound like you, not a robot.</p>
              </div>
              <div className="lp-about-preview">
                <p>"I'm a 3rd year CS student from Hyderabad. I talk in Hinglish with my family. I call my mom 'ma'. I'm usually in classes till 5pm. I keep it short and real."</p>
                <p className="lp-about-cta">→ AI uses this for every reply</p>
              </div>
            </div>

            {[
              { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>, title: 'Per-contact Knowledge Base', desc: 'Write context for each contact — topics, inside jokes, their schedule. AI customises replies per relationship.' },
              { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>, title: 'Hinglish natively supported', desc: 'Auto-detect or pin to English, Hindi, Hinglish, or Tamil. AI code-switches just like you do.' },
              { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>, title: 'Auto-Away detection', desc: 'After X minutes of inactivity, Presenz switches Away automatically — nothing slips even when you forget.' },
              { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>, title: 'Full activity log', desc: 'See every AI reply — who it replied to, what it said, and when. Stay in control without being glued to your phone.' },
            ].map((f) => (
              <div key={f.title} className="lp-feature-card">
                <div className="lp-feature-icon">{f.icon}</div>
                <h3 className="lp-feature-title">{f.title}</h3>
                <p className="lp-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="lp-section">
        <div className="lp-container">
          <p className="lp-section-label">Real users</p>
          <h2 className="lp-section-title">They stopped worrying<br />about missing messages</h2>
          <div className="lp-testimonial-grid">
            {[
              { stars: '★★★★★', text: '"My mom used to stress when I didn\'t reply during practicals. Now she gets a reply in 2 minutes that actually sounds like me. She had no idea it was AI for a week!"', name: 'Rahul K.', role: 'Engineering student, Pune', color: '#0d7a5f', initial: 'R' },
              { stars: '★★★★★', text: '"I work night shifts at a startup. Presenz handles my family\'s messages while I\'m heads-down. The Hinglish replies are spot on — tone, everything."', name: 'Priya S.', role: 'Software developer, Bangalore', color: '#8e44ad', initial: 'P' },
              { stars: '★★★★☆', text: '"The knowledge base feature is underrated. I wrote what my girlfriend and I usually talk about and the replies have been surprisingly good. Setup was under 5 mins."', name: 'Arjun M.', role: 'MBA student, Hyderabad', color: '#e67e22', initial: 'A' },
            ].map((t) => (
              <div key={t.name} className="lp-testimonial-card">
                <div className="lp-stars">{t.stars}</div>
                <p className="lp-testimonial-text">{t.text}</p>
                <div className="lp-testimonial-author">
                  <div className="lp-testimonial-avatar" style={{ background: t.color }}>{t.initial}</div>
                  <div>
                    <p className="lp-testimonial-name">{t.name}</p>
                    <p className="lp-testimonial-role">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="lp-pricing-section" id="pricing">
        <div className="lp-container">
          <p className="lp-section-label" style={{ textAlign: 'center' }}>Pricing</p>
          <h2 className="lp-section-title" style={{ textAlign: 'center' }}>Simple, honest pricing</h2>
          <p className="lp-section-sub" style={{ marginInline: 'auto', textAlign: 'center' }}>Start free. Upgrade when you need more.</p>
          <div className="lp-pricing-grid">
            {[
              { plan: 'Trial', price: 'Free', period: '7 days, no card needed', featured: false, features: ['2 protected contacts', '50 AI replies / day', 'Hinglish + English', 'Basic knowledge base'], noFeatures: ['Activity log', 'Priority support'] },
              { plan: 'Basic', price: '₹199', period: 'per month', featured: true, features: ['5 protected contacts', '200 AI replies / day', 'All 4 languages', 'Full knowledge base', 'Activity log'], noFeatures: ['Priority support'] },
              { plan: 'Pro', price: '₹499', period: 'per month', featured: false, features: ['Unlimited contacts', 'Unlimited AI replies', 'All 4 languages', 'Full knowledge base', 'Activity log', 'Priority support'], noFeatures: [] },
            ].map((p) => (
              <div key={p.plan} className={`lp-pricing-card${p.featured ? ' lp-pricing-featured' : ''}`}>
                {p.featured && <div className="lp-pricing-badge">Most popular</div>}
                <p className="lp-pricing-plan">{p.plan}</p>
                <div className="lp-pricing-price">{p.price}</div>
                <p className="lp-pricing-period">{p.period}</p>
                <ul className="lp-pricing-features">
                  {p.features.map(f => <li key={f}>{f}</li>)}
                  {p.noFeatures.map(f => <li key={f} className="lp-no">{f}</li>)}
                </ul>
                <Link to="/register" className={`lp-btn lp-pricing-btn ${p.featured ? 'lp-btn-primary' : 'lp-btn-secondary'}`}>
                  {p.plan === 'Trial' ? 'Start free trial' : p.plan === 'Pro' ? 'Go Pro' : 'Get started'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-cta-box">
            <h2 className="lp-cta-title">Stop missing messages.<br />Start being present.</h2>
            <p className="lp-cta-sub">Join students and professionals who let Presenz handle WhatsApp while they focus on what matters.</p>
            <div className="lp-cta-actions">
              <Link to="/register" className="lp-btn lp-btn-white lp-btn-lg">Get started free</Link>
              <Link to="/login" className="lp-btn lp-btn-outline-white lp-btn-lg">Already have an account</Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-grid">
            <div>
              <div className="lp-footer-brand">Presenz</div>
              <p className="lp-footer-brand-desc">AI-powered WhatsApp assistant that replies like you when you can't.</p>
            </div>
            <div>
              <p className="lp-footer-col-title">Product</p>
              <ul className="lp-footer-links">
                <li><a href="#how-it-works">How it works</a></li>
                <li><a href="#features">Features</a></li>
                <li><a href="#pricing">Pricing</a></li>
              </ul>
            </div>
            <div>
              <p className="lp-footer-col-title">Account</p>
              <ul className="lp-footer-links">
                <li><Link to="/register">Sign up</Link></li>
                <li><Link to="/login">Log in</Link></li>
              </ul>
            </div>
            <div>
              <p className="lp-footer-col-title">Legal</p>
              <ul className="lp-footer-links">
                <li><a href="#">Privacy Policy</a></li>
                <li><a href="#">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <p className="lp-footer-copy">© 2026 Presenz. Made with ❤️ in India.</p>
          </div>
        </div>
      </footer>
    </>
  );
};

/* ─── ALL CSS scoped with lp- prefix so it never conflicts with your app styles ─── */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');

  .lp-container { max-width: 1160px; margin-inline: auto; padding-inline: 1.5rem; }

  /* NAV */
  nav { position: sticky; top: 0; z-index: 100; background: rgba(247,249,248,0.9); backdrop-filter: blur(12px); border-bottom: 1px solid #e2e8e4; }
  .lp-nav-inner { display: flex; align-items: center; justify-content: space-between; height: 64px; }
  .lp-nav-logo { display: flex; align-items: center; gap: 0.5rem; font-family: 'Instrument Serif', Georgia, serif; font-size: 1.4rem; color: #1a2420; text-decoration: none; }
  .lp-nav-logo svg { color: #0d7a5f; }
  .lp-nav-links { display: flex; align-items: center; gap: 1.5rem; }
  .lp-nav-links a { font-size: 0.9rem; font-weight: 500; color: #5a6b64; text-decoration: none; transition: color 180ms; }
  .lp-nav-links a:hover { color: #1a2420; }
  .lp-nav-cta { display: flex; align-items: center; gap: 0.75rem; }
  @media(max-width:680px){ .lp-nav-links { display: none; } .lp-nav-login { display: none; } }

  /* BUTTONS */
  .lp-btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.625rem 1.25rem; border-radius: 9999px; font-size: 0.9rem; font-weight: 600; cursor: pointer; text-decoration: none; transition: all 180ms cubic-bezier(0.16,1,0.3,1); white-space: nowrap; border: none; }
  .lp-btn-primary { background: #0d7a5f; color: #fff; }
  .lp-btn-primary:hover { background: #0a6350; box-shadow: 0 4px 16px rgba(0,0,0,0.12); transform: translateY(-1px); }
  .lp-btn-secondary { background: #fff; color: #1a2420; border: 1.5px solid rgba(0,0,0,0.12); }
  .lp-btn-secondary:hover { border-color: #0d7a5f; color: #0d7a5f; }
  .lp-btn-lg { padding: 0.875rem 2rem; font-size: 1rem; }
  .lp-btn-white { background: #fff; color: #0d7a5f; }
  .lp-btn-white:hover { background: #f0faf7; box-shadow: 0 4px 16px rgba(0,0,0,0.1); transform: translateY(-1px); }
  .lp-btn-outline-white { border: 2px solid rgba(255,255,255,0.5); color: #fff; background: transparent; }
  .lp-btn-outline-white:hover { background: rgba(255,255,255,0.1); border-color: #fff; }

  /* HERO */
  .lp-hero { padding: clamp(4rem,8vw,6rem) 0 clamp(3rem,6vw,5rem); }
  .lp-hero-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center; }
  @media(max-width:768px){ .lp-hero-inner { grid-template-columns: 1fr; text-align: center; } }
  .lp-hero-tag { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.25rem 1rem; background: #e6f4f0; color: #0d7a5f; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 1.25rem; }
  .lp-hero h1 { font-family: 'Instrument Serif', Georgia, serif; font-size: clamp(2.8rem,5.5vw,6rem); font-weight: 400; color: #1a2420; margin-bottom: 1.5rem; line-height: 1.08; }
  .lp-hero h1 em { color: #0d7a5f; font-style: italic; }
  .lp-hero-sub { font-size: clamp(1.125rem,1.5vw,1.25rem); color: #5a6b64; max-width: 52ch; margin-bottom: 2rem; line-height: 1.65; }
  @media(max-width:768px){ .lp-hero-sub { margin-inline: auto; } }
  .lp-hero-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
  @media(max-width:768px){ .lp-hero-actions { justify-content: center; } }
  .lp-hero-trust { display: flex; align-items: center; gap: 0.75rem; margin-top: 1.5rem; }
  @media(max-width:768px){ .lp-hero-trust { justify-content: center; } }
  .lp-hero-trust-text { font-size: 0.75rem; color: #9aada6; }
  .lp-trust-avatar { width: 28px; height: 28px; border-radius: 50%; border: 2px solid #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; }

  /* PHONE */
  .lp-hero-visual { position: relative; }
  @media(max-width:768px){ .lp-hero-visual { order: -1; max-width: 280px; margin-inline: auto; } }
  .lp-float-badge { position: absolute; top: -16px; right: -8px; background: #fff; border-radius: 0.75rem; padding: 0.625rem 1rem; box-shadow: 0 4px 16px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; font-weight: 600; color: #1a2420; border: 1px solid rgba(0,0,0,0.08); animation: lp-float 3s ease-in-out infinite; }
  @keyframes lp-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
  .lp-float-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; }
  .lp-phone-mockup { background: #1a2420; border-radius: 32px; padding: 14px; box-shadow: 0 24px 60px rgba(0,0,0,0.25); max-width: 260px; margin-inline: auto; }
  .lp-phone-screen { background: #0d1117; border-radius: 20px; overflow: hidden; }
  .lp-phone-header { background: #1a2420; padding: 12px 14px; display: flex; align-items: center; gap: 10px; }
  .lp-phone-avatar { width: 34px; height: 34px; border-radius: 50%; background: #0d7a5f; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: #fff; flex-shrink: 0; }
  .lp-phone-contact-name { font-size: 13px; font-weight: 600; color: #e6ede9; }
  .lp-phone-contact-status { font-size: 11px; color: #6b8a7e; }
  .lp-phone-messages { padding: 12px; display: flex; flex-direction: column; gap: 8px; min-height: 200px; }
  .lp-msg { max-width: 80%; padding: 8px 12px; border-radius: 12px; font-size: 12px; line-height: 1.45; }
  .lp-msg-in { background: #1e2d27; color: #c8ddd6; border-bottom-left-radius: 4px; align-self: flex-start; }
  .lp-msg-out { background: #0d7a5f; color: #fff; border-bottom-right-radius: 4px; align-self: flex-end; }
  .lp-msg-time { font-size: 10px; opacity: 0.6; margin-top: 3px; text-align: right; }
  .lp-ai-badge { display: inline-flex; align-items: center; gap: 4px; background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.75); font-size: 9px; padding: 2px 6px; border-radius: 99px; margin-top: 4px; }
  .lp-typing { display: flex; gap: 4px; align-items: center; padding: 8px 12px; background: #1e2d27; border-radius: 12px; border-bottom-left-radius: 4px; width: fit-content; }
  .lp-dot { width: 6px; height: 6px; border-radius: 50%; background: #6b8a7e; animation: lp-bounce 1.2s infinite; }
  .lp-dot:nth-child(2){ animation-delay: .2s; }
  .lp-dot:nth-child(3){ animation-delay: .4s; }
  @keyframes lp-bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-4px)} }

  /* SOCIAL PROOF */
  .lp-social-proof { padding: 2.5rem 0; border-top: 1px solid #e2e8e4; border-bottom: 1px solid #e2e8e4; }
  .lp-social-proof-label { text-align: center; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #9aada6; margin-bottom: 1.5rem; }
  .lp-social-proof-numbers { display: flex; justify-content: center; gap: clamp(2rem,6vw,5rem); flex-wrap: wrap; }
  .lp-stat-item { text-align: center; }
  .lp-stat-num { font-family: 'Instrument Serif', Georgia, serif; font-size: clamp(1.5rem,2.5vw,2.25rem); color: #1a2420; }
  .lp-stat-label { font-size: 0.75rem; color: #5a6b64; margin-top: 0.25rem; }

  /* SECTIONS */
  .lp-section { padding: clamp(4rem,8vw,6rem) 0; }
  .lp-section-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: #0d7a5f; margin-bottom: 1rem; }
  .lp-section-title { font-family: 'Instrument Serif', Georgia, serif; font-size: clamp(2rem,3.5vw,3.5rem); color: #1a2420; margin-bottom: 1rem; line-height: 1.12; }
  .lp-section-sub { font-size: clamp(1.125rem,1.5vw,1.25rem); color: #5a6b64; max-width: 52ch; line-height: 1.65; }

  /* HOW IT WORKS */
  .lp-steps-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 2rem; margin-top: 3rem; }
  @media(max-width:680px){ .lp-steps-grid { grid-template-columns: 1fr; } }
  .lp-step-card { background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 1rem; padding: 2rem; transition: box-shadow 180ms, transform 180ms; }
  .lp-step-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); transform: translateY(-2px); }
  .lp-step-number { font-family: 'Instrument Serif', Georgia, serif; font-size: 3rem; color: #c8e8e0; line-height: 1; margin-bottom: 1rem; }
  .lp-step-title { font-size: 1.125rem; font-weight: 600; color: #1a2420; margin-bottom: 0.5rem; }
  .lp-step-desc { font-size: 0.9rem; color: #5a6b64; line-height: 1.75; }

  /* FEATURES */
  .lp-features-section { background: #f0f5f2; padding: clamp(4rem,8vw,6rem) 0; }
  .lp-features-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 1.5rem; margin-top: 3rem; }
  @media(max-width:680px){ .lp-features-grid { grid-template-columns: 1fr; } }
  .lp-feature-card { background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 1rem; padding: 1.5rem; }
  .lp-feature-wide { grid-column: span 2; display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: center; }
  @media(max-width:680px){ .lp-feature-wide { grid-column: span 1; grid-template-columns: 1fr; } }
  .lp-feature-icon { width: 44px; height: 44px; border-radius: 0.75rem; background: #e6f4f0; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; color: #0d7a5f; }
  .lp-feature-title { font-size: 1rem; font-weight: 600; color: #1a2420; margin-bottom: 0.5rem; }
  .lp-feature-desc { font-size: 0.875rem; color: #5a6b64; line-height: 1.75; }
  .lp-about-preview { background: #e6f4f0; border-radius: 0.75rem; padding: 1.25rem; font-size: 0.875rem; color: #5a6b64; font-style: italic; line-height: 1.8; }
  .lp-about-cta { color: #0d7a5f; font-size: 0.75rem; font-weight: 600; margin-top: 0.75rem; font-style: normal; }

  /* TESTIMONIALS */
  .lp-testimonial-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1.5rem; margin-top: 3rem; }
  @media(max-width:768px){ .lp-testimonial-grid { grid-template-columns: 1fr; } }
  .lp-testimonial-card { background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 1rem; padding: 1.5rem; }
  .lp-stars { color: #f4a027; font-size: 0.875rem; margin-bottom: 1rem; letter-spacing: 2px; }
  .lp-testimonial-text { font-size: 0.875rem; color: #5a6b64; line-height: 1.8; margin-bottom: 1rem; }
  .lp-testimonial-author { display: flex; align-items: center; gap: 0.75rem; }
  .lp-testimonial-avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; color: #fff; flex-shrink: 0; }
  .lp-testimonial-name { font-size: 0.875rem; font-weight: 600; color: #1a2420; }
  .lp-testimonial-role { font-size: 0.75rem; color: #9aada6; }

  /* PRICING */
  .lp-pricing-section { background: #f0f5f2; padding: clamp(4rem,8vw,6rem) 0; }
  .lp-pricing-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1.5rem; margin-top: 3rem; align-items: start; }
  @media(max-width:768px){ .lp-pricing-grid { grid-template-columns: 1fr; max-width: 380px; margin-inline: auto; } }
  .lp-pricing-card { background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 1rem; padding: 2rem; position: relative; }
  .lp-pricing-featured { border-color: #0d7a5f; box-shadow: 0 0 0 2px #0d7a5f; }
  .lp-pricing-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #0d7a5f; color: #fff; font-size: 0.75rem; font-weight: 700; padding: 0.2rem 1rem; border-radius: 9999px; white-space: nowrap; }
  .lp-pricing-plan { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #5a6b64; margin-bottom: 0.75rem; }
  .lp-pricing-price { font-family: 'Instrument Serif', Georgia, serif; font-size: clamp(2rem,3vw,3rem); color: #1a2420; line-height: 1; }
  .lp-pricing-period { font-size: 0.875rem; color: #5a6b64; margin-top: 0.25rem; margin-bottom: 1.5rem; }
  .lp-pricing-features { list-style: none; display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 2rem; }
  .lp-pricing-features li { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; color: #5a6b64; }
  .lp-pricing-features li::before { content: "✓"; font-weight: 700; color: #0d7a5f; flex-shrink: 0; }
  .lp-pricing-features li.lp-no::before { content: "–"; color: #9aada6; }
  .lp-pricing-features li.lp-no { color: #9aada6; }
  .lp-pricing-btn { width: 100%; justify-content: center; border-radius: 0.625rem; }

  /* CTA */
  .lp-cta-box { background: #0d7a5f; border-radius: 2rem; padding: clamp(3rem,6vw,5rem); text-align: center; position: relative; overflow: hidden; }
  .lp-cta-box::before { content: ''; position: absolute; top: -40%; right: -10%; width: 400px; height: 400px; border-radius: 50%; background: rgba(255,255,255,0.04); pointer-events: none; }
  .lp-cta-title { font-family: 'Instrument Serif', Georgia, serif; font-size: clamp(2rem,3.5vw,3.5rem); color: #fff; margin-bottom: 1rem; line-height: 1.15; }
  .lp-cta-sub { font-size: 1rem; color: rgba(255,255,255,0.72); max-width: 48ch; margin-inline: auto; margin-bottom: 2rem; line-height: 1.7; }
  .lp-cta-actions { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }

  /* FOOTER */
  .lp-footer { background: #1a2420; color: rgba(255,255,255,0.5); padding: 4rem 0 2rem; }
  .lp-footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 3rem; margin-bottom: 3rem; }
  @media(max-width:768px){ .lp-footer-grid { grid-template-columns: 1fr 1fr; } }
  @media(max-width:480px){ .lp-footer-grid { grid-template-columns: 1fr; } }
  .lp-footer-brand { font-family: 'Instrument Serif', Georgia, serif; font-size: 1.4rem; color: #fff; margin-bottom: 0.75rem; }
  .lp-footer-brand-desc { font-size: 0.875rem; color: rgba(255,255,255,0.4); line-height: 1.7; max-width: 28ch; }
  .lp-footer-col-title { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: rgba(255,255,255,0.3); margin-bottom: 1rem; }
  .lp-footer-links { list-style: none; display: flex; flex-direction: column; gap: 0.75rem; }
  .lp-footer-links a { font-size: 0.875rem; color: rgba(255,255,255,0.45); text-decoration: none; transition: color 180ms; }
  .lp-footer-links a:hover { color: #fff; }
  .lp-footer-bottom { border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1.5rem; }
  .lp-footer-copy { font-size: 0.75rem; color: rgba(255,255,255,0.25); }
`;

export default Landing;