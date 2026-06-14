// ============================================================
// 🧠 SCMS AI Classifier — Offline Keyword-Based Engine
// ============================================================
// Replaces @xenova/transformers to eliminate the cold-start
// hang caused by downloading ~150MB ONNX model files from
// HuggingFace on first use.
//
// This classifier runs instantly with zero network calls,
// zero model downloads, and zero startup delay.
// Output is API-compatible with the old Xenova version.
// ============================================================

class AIClassifier {

  // ── Category keyword map ──────────────────────────────────
  static CATEGORY_RULES = [
    {
      label: 'Emergency',
      keywords: ['fire', 'accident', 'flood', 'collapse', 'earthquake', 'explosion',
                 'gas leak', 'injury', 'death', 'dead', 'rescue', 'evacuate', 'disaster',
                 'critical', 'emergency', 'urgent', 'help', 'danger', 'hazard', 'fallen tree']
    },
    {
      label: 'Traffic',
      keywords: ['traffic', 'road block', 'pothole', 'accident', 'signal', 'jam',
                 'vehicle', 'parking', 'highway', 'bridge', 'diversion', 'speed breaker',
                 'road damage', 'broken road', 'crater', 'construction blocking']
    },
    {
      label: 'Pollution',
      keywords: ['pollution', 'smoke', 'toxic', 'chemical', 'smell', 'odour', 'odor',
                 'sewage', 'drain overflow', 'contaminated', 'water pollution', 'air quality',
                 'factory', 'industrial', 'fumes', 'garbage burning', 'open burning']
    },
    {
      label: 'Sanitation',
      keywords: ['garbage', 'waste', 'trash', 'rubbish', 'litter', 'dump', 'dirty',
                 'cleanliness', 'toilet', 'open defecation', 'drain', 'blocked drain',
                 'sewer', 'mosquito', 'rats', 'pest', 'flies', 'unhygienic', 'filth']
    },
    {
      label: 'Infrastructure',
      keywords: ['streetlight', 'light', 'electricity', 'power cut', 'water supply',
                 'pipe burst', 'leakage', 'building', 'wall', 'footpath', 'pavement',
                 'park', 'playground', 'public toilet', 'government', 'broken', 'damaged',
                 'maintenance', 'repair', 'construction', 'infrastructure', 'facility']
    },
    {
      label: 'Noise',
      keywords: ['noise', 'loud', 'sound', 'music', 'speaker', 'honking', 'disturbance',
                 'party', 'fireworks', 'generator', 'drilling', 'construction noise']
    },
  ];

  // ── Severity keyword map ──────────────────────────────────
  static HIGH_KEYWORDS = [
    'urgent', 'danger', 'dangerous', 'help', 'broken', 'collapse', 'collapsed',
    'fire', 'flood', 'emergency', 'critical', 'severe', 'immediately', 'dead',
    'injury', 'injured', 'accident', 'explosion', 'gas leak', 'rescue', 'evacuate'
  ];

  static MEDIUM_KEYWORDS = [
    'broken', 'damaged', 'leak', 'leaking', 'overflow', 'blocked', 'garbage',
    'pothole', 'power cut', 'no water', 'sewage', 'drain', 'waste', 'dirty'
  ];

  // ── Distress words for pseudo-sentiment ──────────────────
  static NEGATIVE_WORDS = [
    'broken', 'dangerous', 'urgent', 'terrible', 'horrible', 'awful', 'worst',
    'dirty', 'disgusting', 'problem', 'issue', 'complaint', 'damaged', 'failure',
    'blocked', 'overflowing', 'leaking', 'collapsed', 'injured', 'dead', 'fire',
    'flood', 'accident', 'help', 'critical', 'severe', 'immediately', 'please'
  ];

  // ── Main classification method (async to match old API) ──
  static async classifyComplaint(description) {
    try {
      const text = (description || '').toLowerCase();
      const words = text.match(/\b\w+\b/g) || [];

      // 1. Score each category
      const scores = AIClassifier.CATEGORY_RULES.map(rule => {
        let score = 0;
        for (const kw of rule.keywords) {
          if (text.includes(kw)) score += kw.includes(' ') ? 2 : 1; // multi-word phrases score higher
        }
        return { label: rule.label, score };
      });

      scores.sort((a, b) => b.score - a.score);
      const topCategory = scores[0].score > 0 ? scores[0].label : 'Infrastructure';
      const totalScore  = scores.reduce((s, c) => s + c.score, 0) || 1;
      const confidence  = Math.min(scores[0].score / totalScore, 0.99);

      // 2. Severity
      const highSevCategories = ['Emergency', 'Traffic', 'Pollution'];
      const hasHighKeyword  = AIClassifier.HIGH_KEYWORDS.some(kw => text.includes(kw));
      const hasMedKeyword   = AIClassifier.MEDIUM_KEYWORDS.some(kw => text.includes(kw));

      let severity = 'Low';
      if (highSevCategories.includes(topCategory) || hasHighKeyword) {
        severity = 'High';
      } else if (['Infrastructure', 'Sanitation'].includes(topCategory) || hasMedKeyword) {
        severity = 'Medium';
      }

      // 3. Pseudo-sentiment (negative word ratio)
      const negCount = words.filter(w => AIClassifier.NEGATIVE_WORDS.includes(w)).length;
      const sentimentScore = words.length > 0 ? Math.min(negCount / words.length * 5, 0.99) : 0.5;
      const sentiment = sentimentScore > 0.2 ? 'NEGATIVE' : 'POSITIVE';

      console.log(`🧠 [Classifier] "${description?.slice(0,60)}..." → ${topCategory} | ${severity} | ${sentiment} (${(confidence*100).toFixed(0)}%)`);

      return {
        suggestedCategory: topCategory,
        severity,
        confidence,
        sentiment,
        sentimentScore
      };

    } catch (e) {
      console.error('AI Classification Error:', e);
      return { suggestedCategory: 'Other', severity: 'Medium', confidence: 0, sentiment: 'NEUTRAL', sentimentScore: 0 };
    }
  }
}

module.exports = AIClassifier;
