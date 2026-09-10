"""
IMPA Catalog Seed Generator
---------------------------
Generates an initial realistic dataset of authentic marine products across key
IMPA categories (Safety, Rigging, Fire Fighting, Hand Tools, Engine Spares, Valves).
Provides instant out-of-the-box data so the web dashboard can be tested immediately.
"""

from typing import List, Dict, Any
from db import init_db, upsert_batch, get_stats
from config import DB_PATH

SAMPLE_IMPA_PRODUCTS: List[Dict[str, Any]] = [
    # Category 23: Rigging Equipment & General Deck Items
    {
        "impa_code": "232001",
        "category_code": "23",
        "category_name": "Rigging Equipment & General Deck Items",
        "product_name": "Pilot Ladder Wooden Steps ISO 799",
        "description": "Marine embarkation pilot ladder with non-slip hardwood steps, rubber bottom steps, and synthetic mildew-resistant side ropes. Certified to SOLAS / ISO 799 standards.",
        "uom": "MTR",
        "image_url": "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop&q=80",
        "source_url": "https://www.marine-stores.com/impa/232001",
        "status": "active"
    },
    {
        "impa_code": "232015",
        "category_code": "23",
        "category_name": "Rigging Equipment & General Deck Items",
        "product_name": "Galvanized Bow Shackle Screw Pin 4.75T",
        "description": "High tensile carbon steel Grade 6 bow shackle with screw pin. Hot-dip galvanized for harsh marine offshore environments. Safety factor 6:1. WLL 4.75 Tonnes.",
        "uom": "PCS",
        "image_url": "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80",
        "source_url": "https://www.marine-stores.com/impa/232015",
        "status": "active"
    },
    {
        "impa_code": "232140",
        "category_code": "23",
        "category_name": "Rigging Equipment & General Deck Items",
        "product_name": "Heavy Duty Deck Scupper Plug 3-Inch",
        "description": "Expandable neoprene rubber scupper drain plug with brass marine wing nut mechanism. Prevents accidental overboard fuel and oil discharge during bunkering operations.",
        "uom": "PCS",
        "image_url": "https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=600&auto=format&fit=crop&q=80",
        "source_url": "https://www.marine-stores.com/impa/232140",
        "status": "active"
    },
    {
        "impa_code": "232250",
        "category_code": "23",
        "category_name": "Rigging Equipment & General Deck Items",
        "product_name": "Nylon Mooring Tail 8-Strand 11-Meter",
        "description": "High elasticity 8-strand braided polyamide nylon mooring tail with protected soft eyes at both ends. Absorbs shock loads on ship mooring lines in high-swell berths.",
        "uom": "PCS",
        "image_url": "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=600&auto=format&fit=crop&q=80",
        "source_url": "https://www.marine-stores.com/impa/232250",
        "status": "active"
    },

    # Category 31: Safety Protective Gear & Lifeboat Equipment
    {
        "impa_code": "310101",
        "category_code": "31",
        "category_name": "Safety Protective Gear & Lifeboat Equipment",
        "product_name": "SOLAS Approved Immersion Suit with Light",
        "description": "Flame-retardant 5mm chloroprene waterproof immersion suit equipped with buddy line, lifting harness, whistle, and water-activated SOLAS strobe light. Guarantees 6h thermal protection.",
        "uom": "PCS",
        "image_url": "https://images.unsplash.com/photo-1584467735815-f778f274e296?w=600&auto=format&fit=crop&q=80",
        "source_url": "https://www.marine-stores.com/impa/310101",
        "status": "active"
    },
    {
        "impa_code": "310325",
        "category_code": "31",
        "category_name": "Safety Protective Gear & Lifeboat Equipment",
        "product_name": "SOLAS Inflatable Lifejacket 275N Twin Chamber",
        "description": "Heavy-duty twin chamber automatic inflatable lifejacket with integrated safety harness, sprayhood, emergency locator light, and high-visibility retro-reflective SOLAS tape.",
        "uom": "PCS",
        "image_url": "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&auto=format&fit=crop&q=80",
        "source_url": "https://www.marine-stores.com/impa/310325",
        "status": "active"
    },
    {
        "impa_code": "310512",
        "category_code": "31",
        "category_name": "Safety Protective Gear & Lifeboat Equipment",
        "product_name": "Full Body Fall Arrest Harness with Dorsal D-Ring",
        "description": "Ergonomic maritime fall protection harness made from oil and water repellent polyester webbing. Quick-connect buckles and breathable shoulder padding.",
        "uom": "PCS",
        "image_url": "https://images.unsplash.com/photo-1508873696983-2df5293cb32b?w=600&auto=format&fit=crop&q=80",
        "source_url": "https://www.marine-stores.com/impa/310512",
        "status": "active"
    },

    # Category 33: Fire Fighting & Safety Equipment
    {
        "impa_code": "330105",
        "category_code": "33",
        "category_name": "Fire Fighting & Safety Equipment",
        "product_name": "Dry Powder Fire Extinguisher 9KG Marine Cartridge",
        "description": "Marine MED/Wheelmark approved 9kg ABC dry chemical powder fire extinguisher. Suitable for Class A (solids), Class B (flammable liquids), and Class C (electrical) marine fires.",
        "uom": "PCS",
        "image_url": "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&auto=format&fit=crop&q=80",
        "source_url": "https://www.marine-stores.com/impa/330105",
        "status": "active"
    },
    {
        "impa_code": "330701",
        "category_code": "33",
        "category_name": "Fire Fighting & Safety Equipment",
        "product_name": "All-Rubber Marine Fire Hose 2-Inch 20M Storz Coupling",
        "description": "Synthetic circular woven polyester jacket embedded in vulcanized nitrile rubber. High abrasion, ozone, and seawater resistance. Working pressure 16 bar. Fitted with brass Storz-C couplings.",
        "uom": "PCS",
        "image_url": "https://images.unsplash.com/photo-1582139329536-e7284fece509?w=600&auto=format&fit=crop&q=80",
        "source_url": "https://www.marine-stores.com/impa/330701",
        "status": "active"
    },
    {
        "impa_code": "330830",
        "category_code": "33",
        "category_name": "Fire Fighting & Safety Equipment",
        "product_name": "Self-Contained Breathing Apparatus (SCBA) 6L 300Bar",
        "description": "SOLAS marine firefighting SCBA complete with carbon-composite cylinder (300 bar), balanced pressure reducer, positive pressure demand valve, and panoramic anti-fog full-face mask.",
        "uom": "SET",
        "image_url": "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=600&auto=format&fit=crop&q=80",
        "source_url": "https://www.marine-stores.com/impa/330830",
        "status": "active"
    },

    # Category 35: Hoses & Couplings
    {
        "impa_code": "350120",
        "category_code": "35",
        "category_name": "Hoses & Couplings",
        "product_name": "Bunkering Fuel Oil Composite Hose 4-Inch 10M",
        "description": "Multi-layer thermoplastic composite fuel delivery hose with galvanized internal/external helix wire reinforcement. Ideal for vessel-to-bunker barge transfer of heavy fuel oil (HFO) and MGO.",
        "uom": "MTR",
        "image_url": "https://images.unsplash.com/photo-1541888946425-d0fbb186c5f7?w=600&auto=format&fit=crop&q=80",
        "source_url": "https://www.marine-stores.com/impa/350120",
        "status": "active"
    },
    {
        "impa_code": "350315",
        "category_code": "35",
        "category_name": "Hoses & Couplings",
        "product_name": "Camlock Quick Coupling Type C Female Coupler with Hose Shank 3-Inch",
        "description": "Precision forged marine aluminum alloy Camlock Type C quick disconnect coupling with Buna-N sealing gasket. Operates up to 150 PSI for water, bilge, and washdown systems.",
        "uom": "PCS",
        "image_url": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80",
        "source_url": "https://www.marine-stores.com/impa/350315",
        "status": "active"
    },

    # Category 59: Hand Tools & Measuring Instruments
    {
        "impa_code": "590112",
        "category_code": "59",
        "category_name": "Hand Tools & Measuring Instruments",
        "product_name": "Non-Sparking Beryllium Copper Slogging Ring Spanner 46mm",
        "description": "Heavy forged non-sparking Cu-Be alloy striking ring spanner designed for explosive maritime environments (oil tankers, gas carriers, engine crankcases). Conforms to ATEX Zone 0/1/2.",
        "uom": "PCS",
        "image_url": "https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=600&auto=format&fit=crop&q=80",
        "source_url": "https://www.marine-stores.com/impa/590112",
        "status": "active"
    },
    {
        "impa_code": "590305",
        "category_code": "59",
        "category_name": "Hand Tools & Measuring Instruments",
        "product_name": "Digital Torque Wrench 1/2-Inch Drive 40-200 Nm",
        "description": "Professional reversible ratcheting digital torque wrench with LED peak buzzer indicator, memory logging, and certificate of calibration. Essential for engine cylinder head torquing.",
        "uom": "PCS",
        "image_url": "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=600&auto=format&fit=crop&q=80",
        "source_url": "https://www.marine-stores.com/impa/590305",
        "status": "active"
    },
    {
        "impa_code": "590550",
        "category_code": "59",
        "category_name": "Hand Tools & Measuring Instruments",
        "product_name": "Sounding Tape Steel with Brass Plumb Bob 20M",
        "description": "White enameled stainless steel oil tank gauging sounding tape fitted with heavy spark-proof brass plumb weight. Marked in metric millimeters for ullage and sounding measurement.",
        "uom": "PCS",
        "image_url": "https://images.unsplash.com/photo-1586864387789-628af9feed72?w=600&auto=format&fit=crop&q=80",
        "source_url": "https://www.marine-stores.com/impa/590550",
        "status": "active"
    },

    # Category 63: Power Tools & Pneumatic Equipment
    {
        "impa_code": "630101",
        "category_code": "63",
        "category_name": "Power Tools & Pneumatic Equipment",
        "product_name": "Pneumatic Needle Scaler Jet Chisel 19 Needles",
        "description": "Heavy-duty air-operated needle scaler for descaling rust, slag, and heavy marine fouling from ship hull plating and deck bulkheads. Working pressure 6 bar.",
        "uom": "PCS",
        "image_url": "https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=600&auto=format&fit=crop&q=80",
        "source_url": "https://www.marine-stores.com/impa/630101",
        "status": "active"
    },
    {
        "impa_code": "630320",
        "category_code": "63",
        "category_name": "Power Tools & Pneumatic Equipment",
        "product_name": "Pneumatic Impact Wrench 1-Inch Heavy Duty 2400Nm",
        "description": "Twin hammer high-power pneumatic impact wrench. Designed for heavy ship engine bolting, propeller repairs, and deck windlass assembly.",
        "uom": "PCS",
        "image_url": "https://images.unsplash.com/photo-1616401784845-180882ba9ba8?w=600&auto=format&fit=crop&q=80",
        "source_url": "https://www.marine-stores.com/impa/630320",
        "status": "active"
    },

    # Category 73: Valves & Cocks - Engine Room
    {
        "impa_code": "730102",
        "category_code": "73",
        "category_name": "Valves & Cocks - Engine Room",
        "product_name": "Cast Iron Flanged Globe Valve JIS F7305 10K 50A",
        "description": "Standard marine engine room cast iron globe stop valve conforming to JIS F7305 standard. Bronze trim, rising stem, flanged ends rating 10K. Pressure rating 1.0 MPa.",
        "uom": "PCS",
        "image_url": "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=600&auto=format&fit=crop&q=80",
        "source_url": "https://www.marine-stores.com/impa/730102",
        "status": "active"
    },
    {
        "impa_code": "730240",
        "category_code": "73",
        "category_name": "Valves & Cocks - Engine Room",
        "product_name": "Marine Bronze Quick Closing Valve JIS F7399 5K 40A",
        "description": "Emergency fuel oil quick-closing valve with pneumatic release cylinder and wire-pull lever mechanism. Class certified for SOLAS remote fuel shutoff requirements.",
        "uom": "PCS",
        "image_url": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80",
        "source_url": "https://www.marine-stores.com/impa/730240",
        "status": "active"
    },

    # Category 77: Electrical Equipment, Cables & Lighting
    {
        "impa_code": "770110",
        "category_code": "77",
        "category_name": "Electrical Equipment, Cables & Lighting",
        "product_name": "Explosion Proof LED Floodlight 150W Marine Grade ATEX",
        "description": "Copper-free aluminum alloy casing with toughened borosilicate glass lens. IP66/IP67 rated, seawater corrosion resistant finish. ATEX / IECEx certified for marine tanker weather decks.",
        "uom": "PCS",
        "image_url": "https://images.unsplash.com/photo-1565814636199-ae8133055c1c?w=600&auto=format&fit=crop&q=80",
        "source_url": "https://www.marine-stores.com/impa/770110",
        "status": "active"
    },
    {
        "impa_code": "770350",
        "category_code": "77",
        "category_name": "Electrical Equipment, Cables & Lighting",
        "product_name": "Marine Armoured Power Cable 0.6/1KV 3x2.5mm Tpyc",
        "description": "Cross-linked polyethylene insulated, galvanized steel wire braided, low-smoke zero-halogen (LSZH) marine offshore power cable. Flame retardant IEC 60332-3.",
        "uom": "MTR",
        "image_url": "https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?w=600&auto=format&fit=crop&q=80",
        "source_url": "https://www.marine-stores.com/impa/770350",
        "status": "active"
    },

    # Category 87: Pumps & Air Compressors
    {
        "impa_code": "870105",
        "category_code": "87",
        "category_name": "Pumps & Air Compressors",
        "product_name": "Pneumatic Double Diaphragm Pump 2-Inch Aluminum Sandpiper Type",
        "description": "Self-priming air-operated double diaphragm (AODD) pump with Teflon/Santoprene elastomers. Safely pumps bilge sludge, seawater, waste oil, and chemical washdowns without stalling.",
        "uom": "PCS",
        "image_url": "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=600&auto=format&fit=crop&q=80",
        "source_url": "https://www.marine-stores.com/impa/870105",
        "status": "active"
    }
]

def seed_database() -> int:
    """Initializes DB and inserts all sample marine products."""
    init_db(DB_PATH)
    count = upsert_batch(SAMPLE_IMPA_PRODUCTS, DB_PATH)
    print(f"🌱 Successfully seeded {count} authentic IMPA marine products into {DB_PATH}")
    stats = get_stats(DB_PATH)
    print(f"📊 Current Database Stats: {stats['total_products']} products across {stats['categories_count']} categories.")
    return count

if __name__ == "__main__":
    seed_database()
