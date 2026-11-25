# ScholarFlow — Akademik Literatür, Atıf Analizi & Yazım Stüdyosu

**ScholarFlow**; akademik literatür taramasını, Scite.ai tarzı atıf gücü sıralamasını, bağlam-duyarlı tez/makale yazımını (otomatik APA 7 kaynakça ile) ve Harvard Profesörü seviyesinde akademik hakem denetimini minimal bir editoryal arayüzde birleştiren açık kaynaklı araştırma platformudur.

## ✨ Temel Özellikler

- **Akıllı Makale Tarama & Çekirdek Konu Çevirisi:** Türkçe veya İngilizce sorgulardaki konuşma/komut eklerini ayıklar, konuyu uluslararası akademik terimlere çevirerek **OpenAlex (250M+ makale)**, **Europe PMC** ve **CrossRef** üzerinde tarar.
- **Scite Atıf Gücü Sıralaması & Alaka Filtresi:** Konuyla alakasız makaleleri eler; sonuçları toplam atıf, etkili atıf (influential citations) ve yıllık atıf hızına göre **güçlüden zayıfa** sıralar.
- **Yan Çekmece Makale İnceleme ("İncele / Kenarda Aç"):** Sayfadan ayrılmadan makale özeti, temel bulgular, metodoloji, açık erişim PDF bağlantısı ve tek tıkla kopyalanabilir **APA 7, IEEE, BibTeX** künyeleri.
- **Bağlam-Duyarlı Yazım Stüdyosu & Otomatik APA 7 Kaynakça:** Seçilen makalelerle tez/makale yazarken aktif cümlenizle eşleşen makale bulguları sağ panelde canlı olarak belirir; tek tıkla metin içi `(Yazar, Yıl)` atıfı ve metin sonu **APA 7** kaynakçası oluşturulur.
- **Çok Turlu Akademik AI Asistan & Hakem Denetimi:** Giriş veya API anahtarı gerektirmeyen sunucu-tarafı ücretsiz LLM motoru (veya isteğe bağlı Google Gemini 2.5 bağlantısı) ile hem **Türkiye (YÖK Tez / TÜBİTAK / TR Dizin)** hem **Uluslararası Q1 Dergi (Academic English)** standartlarında metin denetimi.
- **Editoryal Minimal Tasarım:** Tek tıkla **Gündüz (Fildişi Kağıt)** ve **Gece (Obsidyen Karbon)** modu geçişi.

## 🚀 Yerelde Çalıştırma

```bash
npm start
# veya
node server.js
```

Tarayıcıda `http://localhost:3000` adresini açın.
