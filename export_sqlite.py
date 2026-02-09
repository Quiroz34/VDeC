import sqlite3
import json
import sys

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

try:
    print("Connecting to database...")
    conn = sqlite3.connect('dump_restaurante.db')
    conn.row_factory = dict_factory
    cursor = conn.cursor()

    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    
    data = {}
    
    for table_obj in tables:
        table_name = table_obj['name']
        if table_name == 'sqlite_sequence': continue
        
        print(f"Exporting table: {table_name}")
        cursor.execute(f"SELECT * FROM {table_name}")
        rows = cursor.fetchall()
        
        # Parse JSON columns if any (tickets items usually stored as JSON string in SQL)
        if table_name == 'tickets':
            for row in rows:
                if 'items' in row and isinstance(row['items'], str):
                    try:
                        row['items'] = json.loads(row['items'])
                    except:
                        pass
        
        data[table_name] = rows

    # Wrap in expected structure
    final_output = {
        "data": data
    }

    with open('extracted_data.json', 'w', encoding='utf-8') as f:
        json.dump(final_output, f, indent=2, ensure_ascii=False)
        
    print("Export complete: extracted_data.json")

except Exception as e:
    print(f"Error: {e}")
finally:
    if 'conn' in locals():
        conn.close()
