import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Play, Pause, ChevronLeft, ChevronRight, Sparkles, 
  ArrowRight, Compass, ArrowUpRight, Package, Tag,
  Boxes, PlusCircle, RefreshCw, Layers, CheckCircle2
} from 'lucide-react';
import { getProducts } from '../services/productService';
import { formatCurrency } from '../utils/formatters';

// Category-smart fallback image resolver
const getCategoryVisual = (category, productType, index = 0) => {
  const cat = `${category || ''} ${productType || ''}`.toLowerCase();
  if (cat.includes('tile') || cat.includes('vitrified') || cat.includes('slab') || cat.includes('marble') || cat.includes('floor')) {
    return 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80';
  }
  if (cat.includes('sanitary') || cat.includes('closet') || cat.includes('toilet') || cat.includes('basin') || cat.includes('sink')) {
    return 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80';
  }
  if (cat.includes('faucet') || cat.includes('shower') || cat.includes('tap') || cat.includes('mixer') || cat.includes('brass')) {
    return 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=1200&q=80';
  }
  if (cat.includes('wellness') || cat.includes('bath') || cat.includes('spa') || cat.includes('tub')) {
    return 'https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=1200&q=80';
  }
  if (cat.includes('decor') || cat.includes('elevation') || cat.includes('wall') || cat.includes('mosaic')) {
    return 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=1200&q=80';
  }
  
  const defaults = [
    'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1595846519845-68e298c2edd8?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&q=80'
  ];
  return defaults[index % defaults.length];
};

export const Dashboard = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  // Fetch real dynamic products from backend (top 10 products)
  const fetchDashboardProducts = async () => {
    setLoading(true);
    try {
      const prodRes = await getProducts({ limit: 10 });
      const rawProducts = Array.isArray(prodRes?.data) ? prodRes.data : (Array.isArray(prodRes) ? prodRes : []);
      
      // Transform top 10 backend products to showcase items
      const formattedItems = rawProducts.slice(0, 10).map((p, idx) => {
        const prodImg = (p.image || p.productImage || '').trim();
        const hasValidImg = prodImg && !prodImg.includes('statuario.jpg') && (prodImg.startsWith('http') || prodImg.startsWith('data:image'));
        
        return {
          id: p._id || p.id || `prod-${idx}`,
          rawId: p._id || p.id,
          name: p.productName || 'Ceramic Product',
          category: p.category || p.productGroup || 'Tiles & Sanitary',
          dimensions: p.size || p.rangeOrSize || p.range || (p.finish ? `${p.finish} Finish` : (p.colourName ? `Color: ${p.colourName}` : (p.company ? `Brand: ${p.company}` : 'Standard Sizing'))),
          desc: p.fullDescription || `Premium ${p.productName} by ${p.company || 'Maitri Ceramic'}. Ready stock: ${p.availableStock ?? p.currentStock ?? 0} ${p.unit || 'PCS'}.`,
          image: hasValidImg ? prodImg : getCategoryVisual(p.category, p.productType, idx),
          tag: p.company || p.companySkuCode || p.sku || p.category || 'Maitri Ceramic',
          company: p.company || '',
          price: Number(p.salePrice || p.mrp || 0),
          stock: Number(p.availableStock ?? p.currentStock ?? 0),
          unit: p.unit || 'PCS',
          sku: p.companySkuCode || p.sku || 'SKU-NONE',
          link: (p._id || p.id) ? `/products/${p._id || p.id}` : `/products?search=${encodeURIComponent(p.productName || '')}`
        };
      });

      setProducts(formattedItems);
    } catch (err) {
      console.error('Failed to load dashboard products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardProducts();
  }, []);

  const totalCards = products.length;

  // Auto-play timer for smooth 3D carousel progression
  useEffect(() => {
    if (!isPlaying || isHovered || totalCards === 0) return;
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % totalCards);
    }, 3600);
    return () => clearInterval(interval);
  }, [isPlaying, isHovered, totalCards]);

  const handlePrev = () => {
    if (totalCards === 0) return;
    setActiveIndex(prev => (prev - 1 + totalCards) % totalCards);
  };

  const handleNext = () => {
    if (totalCards === 0) return;
    setActiveIndex(prev => (prev + 1) % totalCards);
  };

  const activeItem = products[activeIndex] || null;

  // Helper to compute 3D arc transform for each card relative to activeIndex
  const getCardStyle = (index) => {
    if (totalCards === 0) return {};
    let offset = index - activeIndex;
    if (offset > totalCards / 2) offset -= totalCards;
    if (offset < -totalCards / 2) offset += totalCards;

    const absOffset = Math.abs(offset);
    const isCenter = offset === 0;

    const cardWidth = 220;
    const spacing = 190;
    const translateX = offset * spacing;
    const translateZ = -absOffset * 105;
    const rotateY = -offset * 24;
    const scale = isCenter ? 1.06 : Math.max(0.72, 1 - absOffset * 0.12);
    const opacity = isCenter ? 1 : Math.max(0.4, 1 - absOffset * 0.22);
    const zIndex = 20 - absOffset;
    const isVisible = absOffset <= 3;

    return {
      position: 'absolute',
      width: `${cardWidth}px`,
      height: '310px',
      left: `calc(50% - ${cardWidth / 2}px)`,
      top: '20px',
      transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
      opacity: isVisible ? opacity : 0,
      zIndex,
      pointerEvents: isVisible ? 'auto' : 'none',
      transition: 'all 0.65s cubic-bezier(0.25, 1, 0.5, 1)',
      transformStyle: 'preserve-3d',
      cursor: 'pointer'
    };
  };

  return (
    <div style={{
      width: '100%',
      minHeight: '100%',
      backgroundColor: '#ffffff',
      color: '#0f172a',
      fontFamily: 'var(--font-family)',
      paddingBottom: '3.5rem',
      margin: 0
    }}>
      
      {/* ── 1. Hero Header & 3D Carousel Section with Luxury Showroom Background ── */}
      <div style={{
        position: 'relative',
        backgroundImage: 'linear-gradient(140deg, rgba(8, 12, 22, 0.91) 0%, rgba(15, 23, 42, 0.88) 35%, rgba(26, 21, 65, 0.85) 70%, rgba(8, 12, 22, 0.94) 100%), url("https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1920&q=80")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        overflow: 'hidden',
        padding: '3.5rem 1.5rem 2.5rem 1.5rem',
        marginBottom: '2.5rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)'
      }}>
        {/* Ambient Radial Glow Overlays */}
        <div style={{
          position: 'absolute',
          top: '-15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '750px',
          height: '450px',
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.22) 0%, rgba(147, 51, 234, 0.12) 45%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 1,
          filter: 'blur(30px)'
        }} />

        <div style={{
          textAlign: 'center',
          maxWidth: '880px',
          margin: '0 auto 2.25rem auto',
          position: 'relative',
          zIndex: 2
        }}>
          {/* Top Studio Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: '30px',
            padding: '0.45rem 1.25rem',
            color: '#93c5fd',
            fontSize: '0.8rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            marginBottom: '1.25rem',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
            backdropFilter: 'blur(10px)'
          }}>
            <Sparkles size={15} style={{ color: '#60a5fa' }} />
            <span>MAITRI CERAMIC • LUXURY TILES & SANITARY STUDIO</span>
          </div>

          {/* Hero Title */}
          <h1 style={{
            fontSize: '2.75rem',
            fontWeight: 900,
            color: '#ffffff',
            lineHeight: 1.18,
            margin: '0 0 0.95rem 0',
            letterSpacing: '-0.025em',
            textShadow: '0 2px 12px rgba(0, 0, 0, 0.4)'
          }}>
            Experience Luxury in <span style={{
              background: 'linear-gradient(135deg, #60a5fa 0%, #38bdf8 50%, #c084fc 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: 'none'
            }}>Ceramic & Tiles</span> Design
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: '1.05rem',
            color: '#cbd5e1',
            lineHeight: 1.65,
            margin: '0 auto 1.85rem auto',
            maxWidth: '720px',
            fontWeight: 400
          }}>
            Explore live product collections, glazed vitrified slabs, modern sanitaryware suites, and designer fittings directly from inventory.
          </p>

          {/* Central CTA Buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
            <Link
              to="/products"
              className="btn"
              style={{
                borderRadius: '30px',
                padding: '0.8rem 2.25rem',
                fontWeight: 700,
                fontSize: '0.95rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.6rem',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 8px 24px rgba(37, 99, 235, 0.45)',
                transition: 'all 0.25s ease',
                cursor: 'pointer',
                textDecoration: 'none'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 30px rgba(37, 99, 235, 0.6)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(37, 99, 235, 0.45)';
              }}
            >
              <Compass size={18} />
              <span>Explore Live Catalog</span>
              <ArrowRight size={16} />
            </Link>

            <Link
              to="/products/new"
              className="btn"
              style={{
                borderRadius: '30px',
                padding: '0.8rem 1.8rem',
                fontWeight: 700,
                fontSize: '0.95rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.25s ease',
                cursor: 'pointer',
                textDecoration: 'none'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <PlusCircle size={18} />
              <span>Add Product</span>
            </Link>
          </div>
        </div>

        {/* ── 2. 3D Curved Arc Carousel (Only Products, Up to 10) ── */}
        {loading ? (
          <div style={{
            height: '380px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#93c5fd',
            gap: '1rem',
            zIndex: 3,
            position: 'relative'
          }}>
            <RefreshCw size={36} className="animate-spin" style={{ animation: 'spin 1.5s linear infinite' }} />
            <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>Loading live ceramic products...</span>
          </div>
        ) : products.length === 0 ? (
          <div style={{
            maxWidth: '600px',
            margin: '2rem auto',
            padding: '2.5rem 1.5rem',
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            textAlign: 'center',
            color: '#ffffff',
            backdropFilter: 'blur(12px)',
            zIndex: 3,
            position: 'relative'
          }}>
            <Package size={48} style={{ color: '#60a5fa', margin: '0 auto 1rem auto' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>No Products in Catalog Yet</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Add your ceramic tiles, sanitaryware, and bath fittings to display them in this 3D showroom carousel.
            </p>
            <Link to="/products/new" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <PlusCircle size={16} />
              <span>Create First Product</span>
            </Link>
          </div>
        ) : (
          <div 
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '1200px',
              margin: '0 auto 1.5rem auto',
              perspective: '1200px',
              height: '380px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
              zIndex: 3
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {/* 3D Scene Wrapper */}
            <div style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              transformStyle: 'preserve-3d'
            }}>
              {products.map((item, idx) => {
                const isCenter = idx === activeIndex;
                return (
                  <div
                    key={item.id}
                    onClick={() => setActiveIndex(idx)}
                    style={getCardStyle(idx)}
                    className="carousel-3d-card"
                  >
                    <div style={{
                      position: 'relative',
                      width: '100%',
                      height: '100%',
                      borderRadius: '18px',
                      overflow: 'hidden',
                      backgroundColor: '#1e293b',
                      border: isCenter ? '2.5px solid #60a5fa' : '1px solid rgba(255, 255, 255, 0.12)',
                      boxShadow: isCenter
                        ? '0 25px 50px rgba(0, 0, 0, 0.45), 0 0 25px rgba(59, 130, 246, 0.35)'
                        : '0 12px 30px rgba(0, 0, 0, 0.3)',
                      transition: 'border 0.3s ease, box-shadow 0.3s ease'
                    }}>
                      {/* Live Product Image */}
                      <img
                        src={item.image}
                        alt={item.name}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = getCategoryVisual(item.category, item.dimensions, idx);
                        }}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                          filter: isCenter ? 'brightness(1.0) contrast(1.05)' : 'brightness(0.75) contrast(0.95)'
                        }}
                      />

                      {/* Top Tag Badge (Company / Brand) */}
                      <div style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        backgroundColor: isCenter ? '#2563eb' : 'rgba(15, 23, 42, 0.75)',
                        color: '#ffffff',
                        fontSize: '0.675rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        padding: '0.25rem 0.65rem',
                        borderRadius: '8px',
                        backdropFilter: 'blur(6px)',
                        border: '1px solid rgba(255, 255, 255, 0.18)',
                        maxWidth: '140px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {item.tag}
                      </div>

                      {/* Single Clean Price Tag */}
                      {item.price > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          backgroundColor: 'rgba(16, 185, 129, 0.92)',
                          color: '#ffffff',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '0.25rem 0.65rem',
                          borderRadius: '8px',
                          backdropFilter: 'blur(6px)',
                          border: '1px solid rgba(255, 255, 255, 0.25)',
                          letterSpacing: '0.02em'
                        }}>
                          {formatCurrency(item.price)}
                        </div>
                      )}

                      {/* Bottom Name Overlay */}
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: '1.5rem 1rem 0.95rem 1rem',
                        background: 'linear-gradient(to top, rgba(9, 13, 22, 0.95) 0%, rgba(9, 13, 22, 0.65) 60%, transparent 100%)',
                        color: '#ffffff',
                        textAlign: 'center'
                      }}>
                        <div style={{
                          fontWeight: 800,
                          fontSize: '0.92rem',
                          lineHeight: 1.25,
                          textShadow: '0 2px 6px rgba(0,0,0,0.6)',
                          marginBottom: '0.2rem',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {item.name}
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#93c5fd',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {item.category} {item.company ? `• ${item.company}` : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Navigation Arrows */}
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous product"
              style={{
                position: 'absolute',
                left: '1.25rem',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.3)',
                backdropFilter: 'blur(10px)',
                zIndex: 30,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.8)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'; }}
            >
              <ChevronLeft size={22} />
            </button>

            <button
              type="button"
              onClick={handleNext}
              aria-label="Next product"
              style={{
                position: 'absolute',
                right: '1.25rem',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.3)',
                backdropFilter: 'blur(10px)',
                zIndex: 30,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.8)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'; }}
            >
              <ChevronRight size={22} />
            </button>
          </div>
        )}

        {/* ── 3. Carousel Dots & Controls (Max 10 Products) ── */}
        {!loading && products.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.65rem',
            position: 'relative',
            zIndex: 3
          }}>
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              title={isPlaying ? 'Pause auto-rotation' : 'Play auto-rotation'}
              style={{
                border: '1px solid rgba(255, 255, 255, 0.2)',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: '#e2e8f0',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                marginRight: '0.4rem',
                backdropFilter: 'blur(6px)'
              }}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>

            {products.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveIndex(idx)}
                aria-label={`Go to product ${idx + 1}`}
                style={{
                  border: 'none',
                  height: '8px',
                  width: activeIndex === idx ? '28px' : '8px',
                  borderRadius: '4px',
                  backgroundColor: activeIndex === idx ? '#60a5fa' : 'rgba(255, 255, 255, 0.25)',
                  boxShadow: activeIndex === idx ? '0 0 10px rgba(96, 165, 250, 0.7)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  padding: 0
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── 4. Dynamic Live Product Spotlight Card (Active Product from API) ── */}
      {activeItem && (
        <div style={{
          maxWidth: '1040px',
          margin: '0 auto 2.5rem auto',
          padding: '0 1rem'
        }}>
          <div style={{
            backgroundColor: '#f8fafc',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '1.75rem 2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1.5rem',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
          }}>
            <div style={{ flex: '1 1 500px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '0.2rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid #bfdbfe'
                }}>
                  {activeItem.category}
                </span>

                {activeItem.company && (
                  <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 700 }}>
                    {activeItem.company}
                  </span>
                )}

                {activeItem.sku && (
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                    SKU: {activeItem.sku}
                  </span>
                )}

                {activeItem.price > 0 && (
                  <span style={{
                    backgroundColor: '#ecfdf5',
                    color: '#059669',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    padding: '0.2rem 0.55rem',
                    borderRadius: '6px',
                    border: '1px solid #a7f3d0'
                  }}>
                    {formatCurrency(activeItem.price)}
                  </span>
                )}
              </div>

              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.35rem 0' }}>
                {activeItem.name}
              </h3>

              <p style={{ fontSize: '0.875rem', color: '#475569', margin: 0, lineHeight: 1.5 }}>
                {activeItem.desc}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <Link
                to={activeItem.link}
                className="btn btn-primary"
                style={{
                  borderRadius: '10px',
                  padding: '0.65rem 1.4rem',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  whiteSpace: 'nowrap',
                  textDecoration: 'none'
                }}
              >
                <span>View Product</span>
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. Featured Live Products Grid (Showing Actual Products, Not Categories) ── */}
      <div style={{
        maxWidth: '1040px',
        margin: '0 auto 2.5rem auto',
        padding: '0 1rem'
      }}>
        <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.2rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Boxes size={20} style={{ color: '#2563eb' }} />
              <span>Featured Products</span>
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
              Live inventory collection from ceramic & sanitary catalog
            </p>
          </div>
          <Link to="/products" style={{ fontSize: '0.825rem', fontWeight: 700, color: '#2563eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>View All Products ({products.length})</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 0.75rem auto', animation: 'spin 1.5s linear infinite' }} />
            <p style={{ fontSize: '0.9rem' }}>Loading products catalog...</p>
          </div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <Package size={36} style={{ color: '#94a3b8', margin: '0 auto 0.75rem auto' }} />
            <p style={{ fontWeight: 600, color: '#334155', margin: '0 0 1rem 0' }}>No products available in the database yet.</p>
            <Link to="/products/new" className="btn btn-primary btn-sm">
              <PlusCircle size={14} style={{ marginRight: '0.35rem' }} />
              <span>Add Your First Product</span>
            </Link>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(235px, 1fr))',
            gap: '1.25rem'
          }}>
            {products.map((prod, idx) => (
              <Link
                key={prod.id || idx}
                to={prod.link}
                style={{
                  textDecoration: 'none',
                  backgroundColor: '#ffffff',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column'
                }}
                onMouseEnter={e => { 
                  e.currentTarget.style.transform = 'translateY(-4px)'; 
                  e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.08)'; 
                  e.currentTarget.style.borderColor = '#93c5fd';
                }}
                onMouseLeave={e => { 
                  e.currentTarget.style.transform = 'translateY(0)'; 
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.03)'; 
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
              >
                {/* Product Image Box */}
                <div style={{ height: '160px', overflow: 'hidden', position: 'relative', backgroundColor: '#f1f5f9' }}>
                  <img
                    src={prod.image}
                    alt={prod.name}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = getCategoryVisual(prod.category, prod.dimensions, idx);
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  
                  {/* Category Pill */}
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    backgroundColor: 'rgba(15, 23, 42, 0.75)',
                    color: '#ffffff',
                    borderRadius: '6px',
                    padding: '0.2rem 0.55rem',
                    fontSize: '0.675rem',
                    fontWeight: 700,
                    backdropFilter: 'blur(6px)',
                    border: '1px solid rgba(255, 255, 255, 0.15)'
                  }}>
                    {prod.category}
                  </div>

                  {/* Stock Pill */}
                  <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '8px',
                    backgroundColor: prod.stock > 0 ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)',
                    color: '#ffffff',
                    borderRadius: '6px',
                    padding: '0.18rem 0.5rem',
                    fontSize: '0.675rem',
                    fontWeight: 700,
                    backdropFilter: 'blur(6px)'
                  }}>
                    {prod.stock > 0 ? `${prod.stock} ${prod.unit}` : 'Out of Stock'}
                  </div>
                </div>

                {/* Product Details */}
                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  {/* Company / Brand */}
                  {prod.company && (
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                      {prod.company}
                    </div>
                  )}

                  {/* Product Title */}
                  <h4 style={{
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    margin: '0 0 0.4rem 0',
                    lineHeight: 1.3,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {prod.name}
                  </h4>

                  {/* SKU */}
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace', marginBottom: '0.65rem' }}>
                    SKU: {prod.sku}
                  </div>

                  {/* Price & Action */}
                  <div style={{
                    marginTop: 'auto',
                    paddingTop: '0.65rem',
                    borderTop: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                      {prod.price > 0 ? formatCurrency(prod.price) : 'Contact for Price'}
                    </div>
                    <span style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      View <ArrowUpRight size={13} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default Dashboard;
