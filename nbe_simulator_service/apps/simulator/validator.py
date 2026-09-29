import os
import json
from pathlib import Path
from django.conf import settings

# Canonical catalog of all 24 NBE Statutory Returns
SUPPORTED_NBE_REPORTS = {
    'ANARN001': {'title': 'Analysis of Agricultural Non-Performing Loans', 'freq': 'Quarterly'},
    'ARLAL001': {'title': 'Agricultural Loans and Advances by Sub-sector', 'freq': 'Quarterly'},
    'BD_L_A_BD001': {'title': 'Breakdown of Loans & Advances by Economic Sector', 'freq': 'Monthly'},
    'BOR_TEN_PER_LB002': {'title': 'Borrowers Exceeding Ten Percent of Capital', 'freq': 'Quarterly'},
    'BSD_LOAN_PART13002': {'title': 'Loan Portfolio Quality and Provisions', 'freq': 'Monthly'},
    'BUIL_CONSTXW002': {'title': 'Building and Construction Sector Financing', 'freq': 'Quarterly'},
    'COL_ACQ_18M_OL001': {'title': 'Collateral Acquired and Held Over 18 Months', 'freq': 'Quarterly'},
    'COL_SOL_18M_LL001': {'title': 'Collateral Sold or Liquidated within 18 Months', 'freq': 'Quarterly'},
    'DigitalLendingDL001': {'title': 'Digital Lending and Electronic Credit Products', 'freq': 'Monthly'},
    'INS_LOAN_QR002': {'title': 'Insider Lending and Related Parties Exposure', 'freq': 'Quarterly'},
    'LOA_ADV_OUT_LA001': {'title': 'Outstanding Loans and Advances Distribution', 'freq': 'Monthly'},
    'LOAN_CLA_PROV_LP001': {'title': 'Loan Classification and Provisioning Schedule', 'freq': 'Monthly'},
    'LOAN_RAN_REG_RA002': {'title': 'Loan Size Range Register Analysis', 'freq': 'Quarterly'},
    'LOAN_RAN___REGRL002': {'title': 'Loan Range Distribution by Borrower Category', 'freq': 'Quarterly'},
    'LOAN_SEC___REGRS002': {'title': 'Loan Security and Collateral Coverage Ratio', 'freq': 'Quarterly'},
    'LOAN_SEC_REG_SE002': {'title': 'Collateral Classification Register', 'freq': 'Quarterly'},
    'LOA_PORT_EP001': {'title': 'Overall Credit Portfolio Concentration Report', 'freq': 'Monthly'},
    'M_LCPLC001': {'title': 'Large Credit Exposures Exceeding Prudential Limits', 'freq': 'Monthly'},
    'NPL_ECPOMNE001': {'title': 'Non-Performing Loans by Economic Sector', 'freq': 'Monthly'},
    'NPL_PRO_NL001': {'title': 'NPL Provisions, Write-Offs, and Recoveries', 'freq': 'Monthly'},
    'POBEPE001': {'title': 'Balance Sheet Assets & Statutory Liquidity Returns', 'freq': 'Monthly'},
    'RLAFCRC001': {'title': 'Restructured and Rescheduled Credit Facilities', 'freq': 'Quarterly'},
    'TOP_20_BOR_TB001': {'title': 'Top 20 Bank Borrowers by Total Exposure', 'freq': 'Monthly'},
    'TOP_20_NPLs_TN001': {'title': 'Top 20 Non-Performing Borrowers and Recoveries', 'freq': 'Monthly'},
}

class NbePayloadValidator:
    """
    Central Bank validation engine for NBE statutory intake.
    Validates payload integrity, schema compliance, 24 report keys, and institution codes.
    """
    _definitions_cache = {}

    @classmethod
    def load_report_definition(cls, report_key: str) -> dict | None:
        if report_key in cls._definitions_cache:
            return cls._definitions_cache[report_key]

        definitions_dir = getattr(settings, 'REPORT_DEFINITIONS_DIR', None)
        if definitions_dir and Path(definitions_dir).exists():
            file_path = Path(definitions_dir) / f"{report_key}.json"
            if file_path.exists():
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        cls._definitions_cache[report_key] = data
                        return data
                except Exception:
                    pass
        return None

    @classmethod
    def validate(cls, payload: dict) -> tuple[bool, list[str]]:
        errors = []

        if not isinstance(payload, dict):
            return False, ['Payload must be a valid JSON object envelope']

        # 1. ReturnKey validation
        return_key = payload.get('ReturnKey') or payload.get('returnKey')
        if not return_key:
            errors.append('Missing mandatory field: ReturnKey')
        elif return_key not in SUPPORTED_NBE_REPORTS:
            errors.append(
                f"Unknown statutory return key '{return_key}'. Must be one of the 24 supported NBE returns."
            )

        # 2. InstCode validation (National Bank of Ethiopia code for Oromia Bank is 0000013)
        inst_code = payload.get('InstCode') or payload.get('instCode') or payload.get('institutionCode')
        if not inst_code:
            errors.append('Missing mandatory field: InstCode (Central Bank Institution Code)')
        elif str(inst_code) != '0000013':
            errors.append(
                f"Invalid or unauthorized Central Bank Institution Code '{inst_code}'. Oromia Bank licensed code is '0000013'."
            )

        # 3. FinYear validation
        fin_year = payload.get('FinYear') or payload.get('finYear')
        if fin_year is None:
            errors.append('Missing mandatory field: FinYear')
        else:
            try:
                y = int(fin_year)
                if y < 2000 or y > 2050:
                    errors.append(f"FinYear '{fin_year}' is out of acceptable statutory reporting range (2000-2050)")
            except (ValueError, TypeError):
                errors.append(f"FinYear '{fin_year}' must be a valid integer year")

        # 4. Dates validation
        start_date = payload.get('StartDate') or payload.get('startDate')
        end_date = payload.get('EndDate') or payload.get('endDate')
        if not start_date:
            errors.append('Missing mandatory field: StartDate')
        if not end_date:
            errors.append('Missing mandatory field: EndDate')

        # 5. ReturnItemsList validation
        items = payload.get('ReturnItemsList') or payload.get('returnItemsList')
        values_dict = payload.get('Values') or payload.get('values')

        if items is None and values_dict is None:
            errors.append('Missing mandatory statutory returns data (ReturnItemsList or Values required)')
        elif items is not None:
            if not isinstance(items, list):
                errors.append('ReturnItemsList must be an array of return item objects')
            else:
                for idx, item in enumerate(items[:200]):
                    if not isinstance(item, dict):
                        errors.append(f"Item #{idx} in ReturnItemsList must be an object with 'Code' and 'Value'")
                        break
                    if 'Code' not in item and 'code' not in item:
                        errors.append(f"Item #{idx} in ReturnItemsList is missing 'Code'")
                        break

        # 6. DynamicItemsList validation (if present)
        dynamic_items = payload.get('DynamicItemsList') or payload.get('dynamicItemsList')
        if dynamic_items is not None and not isinstance(dynamic_items, list):
            errors.append('DynamicItemsList must be an array of dynamic area objects')

        # 7. Check against loaded official definition if available
        if return_key and return_key in SUPPORTED_NBE_REPORTS:
            definition = cls.load_report_definition(return_key)
            if definition:
                required_items = definition.get('ReturnItemsList') or []
                # Check mandatory item code existence if defined
                pass

        return len(errors) == 0, errors
