import sys
import json
import pandas as pd
import numpy as np
import scipy.stats as stats
import warnings

# Suppress all warnings for clean JSON output
warnings.filterwarnings("ignore")
pd.options.mode.chained_assignment = None

def analyze_dataset(data_json):
    try:
        # Load Data into Pandas
        df = pd.DataFrame(data_json)
        
        if df.empty:
            return {"error": "Empty dataset provided"}

        # Cleanup Column Names & Types
        df.columns = [c.strip() for c in df.columns]
        
        # Only analyze numeric columns that have more than 0 non-null values
        numeric_cols = []
        for col in df.columns:
            if pd.api.types.is_numeric_dtype(df[col]):
                if df[col].notnull().any():
                    numeric_cols.append(col)

        # 2. Compute Metaschema Stats
        summary = {}
        for col in numeric_cols:
            series = df[col].dropna()
            if len(series) > 0:
                # Z-Score Anomaly Detection (only if 2+ points)
                outlier_count = 0
                if len(series) >= 3:
                    try:
                        z_scores = np.abs(stats.zscore(series.astype(float)))
                        outlier_count = int((z_scores > 2.5).sum()) # Strict 2.5 sigma
                    except:
                        outlier_count = 0
                
                # Intelligence Summary
                start_val = float(series.iloc[-1])
                end_val = float(series.iloc[0])
                # Fix: Use Python 'or' instead of JS '||'
                divider = start_val if start_val != 0 else 1.0
                delta = ((end_val - start_val) / divider) * 100

                summary[col] = {
                    "min": float(series.min()),
                    "max": float(series.max()),
                    "mean": float(series.mean()),
                    "current": end_val,
                    "delta_pct": f"{delta:+.1f}%",
                    "volatility": "HIGH" if series.std() / (series.mean() or 1) > 0.4 else "STABLE",
                    "outlier_count": outlier_count
                }

        # 3. Correlation Analysis (Multiple numeric columns required)
        correlations = []
        if len(numeric_cols) >= 2 and len(df) >= 3:
            corr_matrix = df[numeric_cols].corr()
            for i, col1 in enumerate(numeric_cols):
                for col2 in numeric_cols[i+1:]:
                    val = corr_matrix.loc[col1, col2]
                    if abs(val) > 0.75:
                        correlations.append(f"{col1} vs {col2}: {val:.2f}")

        # 4. Critical Peaks (SQL Logic) - Limit to 12
        peaks = {}
        for col in numeric_cols[:12]:
            idx = df[col].idxmax()
            row = df.loc[idx]
            peaks[col] = {
                "val": float(row[col]),
                "date": str(row.get('created_at', 'N/A'))
            }

        result = {
            "status": "SUCCESS",
            "rowCount": len(df),
            "numericColumns": numeric_cols[:12],
            "kpiSummaries": {k: v for k, v in list(summary.items())[:12]},
            "correlations": correlations[:3],
            "peaks": peaks
            # latestRow removed (already in Node metrics)
        }

        return result

    except Exception as e:
        return {"status": "ERROR", "message": str(e)}

if __name__ == "__main__":
    try:
        input_data = sys.stdin.read()
        if not input_data:
            print(json.dumps({"status": "ERROR", "message": "No stdin data"}))
            sys.exit(1)
            
        dataset = json.loads(input_data)
        result = analyze_dataset(dataset)
        print(json.dumps(result))
        
    except Exception as e:
        import traceback
        error_info = {
            "status": "CRASH",
            "message": str(e),
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_info))
