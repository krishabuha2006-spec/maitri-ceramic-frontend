import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getProducts } from '../services/productService';
import { getCustomers } from '../services/customerService';
import { getQuotations } from '../services/quotationService';
import { getLowStockReport } from '../services/stockService';
import { 
  Play, Pause, ChevronLeft, ChevronRight, Sparkles, 
  Layers, Package, Users, FileText, Boxes, ArrowRight,
  ShieldCheck, CheckCircle2, Eye, ExternalLink, Image as ImageIcon,
  Flame, Award, Maximize2
} from 'lucide-react';

// Curated high-definition ceramic and luxury tile visuals
const SHOWCASE_SLIDES = [
  {
    id: 1,
    title: 'Glazed Vitrified & Large Format Porcelain Slabs',
    subtitle: 'Ultra-luxurious 800x1600mm & 600x1200mm high gloss and satin matte finishes for contemporary architectural living.',
    category: 'Premium Floor Tiles',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80',
    tag: 'Trending 2026',
    accent: '#2563eb'
  },
  {
    id: 2,
    title: 'Designer Sanitaryware & Smart Wall Hung Closets',
    subtitle: 'Vortex rimless flushing, UF soft-close mechanisms, and matte ceramic color palettes crafted for modern luxury suites.',
    category: 'Sanitaryware Collection',
    image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1600&q=80',
    tag: 'Roca & Luxury Series',
    accent: '#0d9488'
  },
  {
    id: 3,
    title: 'Thermostatic Shower Columns & Concealed Diverters',
    subtitle: 'Precision thermostatic flow control with chrome, matte black, and brushed rose gold architectural fixtures.',
    category: 'Showers & Faucets',
    image: 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=1600&q=80',
    tag: 'Water Wellness',
    accent: '#d97706'
  },
  {
    id: 4,
    title: 'High-Gloss Digital Ceramic Wall & Elevation Tiles',
    subtitle: 'Textured subway, Spanish elevation, and continuous marble vein bookmatch designs for kitchens and bathrooms.',
    category: 'Wall Tiles & Decor',
    image: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=1600&q=80',
    tag: 'Seamless Elegance',
    accent: '#7c3aed'
  }
];

// Curated category gallery items
const CERAMIC_COLLECTIONS = [
  {
    title: 'Vitrified Floor Slabs',
    size: '800x1600 mm / 600x1200 mm',
    desc: 'High traffic endurance, mirror polish glaze, stain resistant.',
    image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=600&q=80',
    link: '/products?category=Tiles'
  },
  {
    title: 'Smart Sanitary Closets',
    size: 'Wall Hung & Integrated Tanks',
    desc: 'Rimless dual flush, anti-bacterial glaze, European design.',
    image: 'https://images.unsplash.com/photo-1564540586988-aa4e53c3d799?auto=format&fit=crop&w=600&q=80',
    link: '/products?category=Sanitaryware'
  },
  {
    title: 'Architectural Faucets',
    size: 'Deck & Wall Mounted Mixers',
    desc: 'Brass body, aerated splash-free flow, premium PVD finishes.',
    image: 'https://images.unsplash.com/photo-1585090124707-16d7a4cb2e0f?auto=format&fit=crop&w=600&q=80',
    link: '/products?category=Faucets'
  },
  {
    title: 'Wellness & Freestanding Tubs',
    size: 'Acrylic & Stone Composite',
    desc: 'Ergonomic contours, drop-in whirlpool massage systems.',
    image: 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=600&q=80',
    link: '/products?category=Wellness'
  }
];

export const Dashboard = () => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [stats, setStats] = useState({
    productsCount: 0,
    customersCount: 0,
    quotationsCount: 0,
    lowStockCount: 0
  });

  // Auto-slide effect
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % SHOWCASE_SLIDES.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [isPlaying]);

  // Load quick live stats
  useEffect(() => {
    Promise.all([
      getProducts({ limit: 10 }).catch(() => ({ total: 0, data: [] })),
      getCustomers().catch(() => ({ data: [] })),
      getQuotations({ limit: 10 }).catch(() => ({ total: 0, data: [] })),
      getLowStockReport().catch(() => [])
    ]).then(([pRes, cRes, qRes, lsRes]) => {
      setStats({
        productsCount: pRes.total || (pRes.data ? pRes.data.length : 0),
        customersCount: Array.isArray(cRes.data) ? cRes.data.length : (Array.isArray(cRes) ? cRes.length : 0),
        quotationsCount: qRes.total || (qRes.data ? qRes.data.length : 0),
        lowStockCount: Array.isArray(lsRes) ? lsRes.length : (lsRes?.data ? lsRes.data.length : 0)
      });
    });
  }, []);

  const slide = SHOWCASE_SLIDES[currentSlide];

  return (
    <div style={{ width: '100%', paddingBottom: '3rem' }}>
      
      {/* 1. Hero Dynamic Ceramic Banner & Video / Image Showcase */}
      <div style={{
        position: 'relative',
        borderRadius: '16px',
        overflow: 'hidden',
        minHeight: '460px',
        backgroundColor: '#0f172a',
        boxShadow: '0 12px 36px rgba(15, 23, 42, 0.15)',
        marginBottom: '2rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end'
      }}>
        {/* Background Image with Smooth Transitions */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${slide.image})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          filter: 'brightness(0.72) contrast(1.05)'
        }}>
          {/* Gradient overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.45) 50%, rgba(15, 23, 42, 0.2) 100%)'
          }} />
        </div>

        {/* Top Floating Badges */}
        <div style={{
          position: 'absolute',
          top: '1.25rem',
          left: '1.5rem',
          right: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: '30px',
            padding: '0.35rem 0.9rem',
            color: '#ffffff',
            fontSize: '0.775rem',
            fontWeight: 700,
            letterSpacing: '0.03em'
          }}>
            <Sparkles size={14} style={{ color: '#60a5fa' }} />
            <span>Maitri Ceramic • Luxury Studio Portfolio</span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                border: 'none',
                backgroundColor: 'rgba(0, 0, 0, 0.45)',
                backdropFilter: 'blur(6px)',
                color: '#ffffff',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              title={isPlaying ? 'Pause slideshow' : 'Play slideshow'}
            >
              {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            </button>
          </div>
        </div>

        {/* Slide Content */}
        <div style={{
          position: 'relative',
          zIndex: 10,
          padding: '2rem 2.5rem',
          maxWidth: '850px'
        }}>
          <div style={{
            display: 'inline-block',
            backgroundColor: slide.accent,
            color: '#ffffff',
            fontSize: '0.725rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '0.2rem 0.65rem',
            borderRadius: '6px',
            marginBottom: '0.75rem'
          }}>
            {slide.tag} • {slide.category}
          </div>

          <h1 style={{
            fontSize: '2rem',
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.2,
            margin: '0 0 0.65rem 0',
            textShadow: '0 2px 10px rgba(0,0,0,0.5)'
          }}>
            {slide.title}
          </h1>

          <p style={{
            fontSize: '0.95rem',
            color: '#e2e8f0',
            lineHeight: 1.5,
            margin: '0 0 1.5rem 0',
            maxWidth: '650px'
          }}>
            {slide.subtitle}
          </p>

          {/* Action CTAs */}
          <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <Link
              to="/products"
              className="btn btn-primary"
              style={{
                borderRadius: '10px',
                padding: '0.65rem 1.4rem',
                fontWeight: 700,
                fontSize: '0.875rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
              }}
            >
              <Package size={16} />
              <span>Explore Products Catalog</span>
              <ArrowRight size={15} />
            </Link>

            <Link
              to="/customers"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.18)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#ffffff',
                borderRadius: '10px',
                padding: '0.65rem 1.25rem',
                fontWeight: 600,
                fontSize: '0.875rem',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'background 0.2s'
              }}
            >
              <Users size={16} />
              <span>Customer Operations Hub</span>
            </Link>
          </div>
        </div>

        {/* Bottom Slide Indicators & Controls */}
        <div style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 2.5rem 1.25rem 2.5rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          {/* Slide Dots */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {SHOWCASE_SLIDES.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                style={{
                  border: 'none',
                  height: '8px',
                  width: idx === currentSlide ? '28px' : '8px',
                  borderRadius: '4px',
                  backgroundColor: idx === currentSlide ? '#ffffff' : 'rgba(255, 255, 255, 0.35)',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          {/* Prev / Next Arrows */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setCurrentSlide(prev => (prev - 1 + SHOWCASE_SLIDES.length) % SHOWCASE_SLIDES.length)}
              style={{
                border: '1px solid rgba(255, 255, 255, 0.25)',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                color: '#ffffff',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setCurrentSlide(prev => (prev + 1) % SHOWCASE_SLIDES.length)}
              style={{
                border: '1px solid rgba(255, 255, 255, 0.25)',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                color: '#ffffff',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Quick Operations Action Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1.25rem',
        marginBottom: '2.5rem'
      }}>
        <Link
          to="/products"
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '1.25rem',
            textDecoration: 'none',
            color: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            transition: 'transform 0.2s, box-shadow 0.2s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ backgroundColor: '#eff6ff', color: '#2563eb', padding: '0.85rem', borderRadius: '10px' }}>
            <Package size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.775rem', color: '#64748b', fontWeight: 600 }}>PRODUCTS CATALOG</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{stats.productsCount} Products</div>
            <span style={{ fontSize: '0.725rem', color: '#2563eb', fontWeight: 600 }}>Browse collection →</span>
          </div>
        </Link>

        <Link
          to="/customers"
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '1.25rem',
            textDecoration: 'none',
            color: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            transition: 'transform 0.2s, box-shadow 0.2s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ backgroundColor: '#f0fdf4', color: '#16a34a', padding: '0.85rem', borderRadius: '10px' }}>
            <Users size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.775rem', color: '#64748b', fontWeight: 600 }}>CUSTOMER HUB</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{stats.customersCount} Clients</div>
            <span style={{ fontSize: '0.725rem', color: '#16a34a', fontWeight: 600 }}>Open Directory →</span>
          </div>
        </Link>

        <Link
          to="/stock"
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '1.25rem',
            textDecoration: 'none',
            color: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            transition: 'transform 0.2s, box-shadow 0.2s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ backgroundColor: '#fff7ed', color: '#ea580c', padding: '0.85rem', borderRadius: '10px' }}>
            <Boxes size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.775rem', color: '#64748b', fontWeight: 600 }}>STOCK & WAREHOUSE</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: stats.lowStockCount > 0 ? '#dc2626' : '#0f172a' }}>
              {stats.lowStockCount > 0 ? `${stats.lowStockCount} Low Stock` : 'Stock Stable'}
            </div>
            <span style={{ fontSize: '0.725rem', color: '#ea580c', fontWeight: 600 }}>Check inventory →</span>
          </div>
        </Link>

        <Link
          to="/quotations/create"
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '1.25rem',
            textDecoration: 'none',
            color: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            transition: 'transform 0.2s, box-shadow 0.2s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ backgroundColor: '#faf5ff', color: '#9333ea', padding: '0.85rem', borderRadius: '10px' }}>
            <FileText size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.775rem', color: '#64748b', fontWeight: 600 }}>QUICK QUOTE</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>Create Quote</div>
            <span style={{ fontSize: '0.725rem', color: '#9333ea', fontWeight: 600 }}>Start estimate →</span>
          </div>
        </Link>
      </div>

      {/* 3. Ceramic Category Collections Showcase Grid */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={22} style={{ color: '#2563eb' }} />
              Featured Ceramic & Sanitaryware Collections
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.825rem', margin: '0.15rem 0 0 0' }}>
              Premium Vitrified, Glazed Ceramic, Faucets, and Luxury Bathroom Solutions.
            </p>
          </div>
          <Link to="/products" className="btn btn-secondary btn-sm" style={{ borderRadius: '8px', fontSize: '0.8rem' }}>
            View Full Inventory
          </Link>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.5rem'
        }}>
          {CERAMIC_COLLECTIONS.map((col, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
                transition: 'transform 0.2s'
              }}
            >
              <div style={{
                height: '180px',
                position: 'relative',
                backgroundImage: `url(${col.image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to top, rgba(15,23,42,0.7) 0%, transparent 60%)'
                }} />
                <span style={{
                  position: 'absolute',
                  bottom: '10px',
                  left: '12px',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(4px)',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '6px'
                }}>
                  {col.size}
                </span>
              </div>

              <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.35rem 0' }}>
                    {col.title}
                  </h3>
                  <p style={{ fontSize: '0.825rem', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                    {col.desc}
                  </p>
                </div>

                <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                  <Link
                    to={col.link}
                    style={{
                      fontSize: '0.825rem',
                      fontWeight: 700,
                      color: '#2563eb',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <span>Explore Collection</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
