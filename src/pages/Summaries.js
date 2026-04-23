import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../context/DataContext';
import { CAR_PROVINCES } from '../constants';
import jsPDF from 'jspdf';
import L from 'leaflet';
import { toPng } from 'html-to-image';
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet';
import {
  BarChart,
  Bar,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import './Summaries.css';
import 'leaflet/dist/leaflet.css';

function toCategory(v) {
  return String(v ?? '').trim().toLowerCase();
}

function hasValue(v) {
  return String(v ?? '').trim() !== '';
}

function asNumber(v) {
  const cleaned = String(v ?? '').replace(/,/g, '').trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function asAreaNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let text = String(v ?? '').trim();
  if (!text) return 0;
  text = text.replace(/[^\d.,-]/g, '');
  if (!text) return 0;
  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSep = lastDot > lastComma ? '.' : ',';
    const thousandsSep = decimalSep === '.' ? ',' : '.';
    text = text.replace(new RegExp(`\\${thousandsSep}`, 'g'), '');
    if (decimalSep === ',') text = text.replace(',', '.');
  } else if (lastComma !== -1 && lastDot === -1) {
    text = text.replace(',', '.');
  } else {
    text = text.replace(/,/g, '');
  }
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

function fmtInt(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function fmtArea(n) {
  return Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getExportStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}_${hours}-${minutes}`;
}

function formatCountTooltip(value, name) {
  return [fmtInt(value), name];
}

function renderBarValueLabel({ x, y, width, value, color }) {
  if (!value) return null;

  return (
    <text
      x={x + width / 2}
      y={y - 6}
      fill={color || '#55607a'}
      fontSize="11"
      fontWeight="700"
      textAnchor="middle"
    >
      {fmtInt(value)}
    </text>
  );
}

function renderPieCalloutLabel({
  cx,
  cy,
  midAngle,
  outerRadius,
  percent,
  name,
  value,
  fill,
}) {
  if (!percent || percent < 0.005) return null;

  const angle = (-midAngle * Math.PI) / 180;
  const lineStartRadius = outerRadius;
  const lineBreakRadius = outerRadius + 18;
  const labelOffset = 22;
  const x1 = cx + lineStartRadius * Math.cos(angle);
  const y1 = cy + lineStartRadius * Math.sin(angle);
  const x2 = cx + lineBreakRadius * Math.cos(angle);
  const y2 = cy + lineBreakRadius * Math.sin(angle);
  const isRightSide = Math.cos(angle) >= 0;
  const x3 = x2 + (isRightSide ? labelOffset : -labelOffset);
  const textAnchor = isRightSide ? 'start' : 'end';

  return (
    <g>
      <path
        d={`M${x1},${y1}L${x2},${y2}L${x3},${y2}`}
        fill="none"
        stroke={fill}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <text
        x={x3 + (isRightSide ? 3 : -3)}
        y={y2}
        fill="#65708a"
        fontSize="14"
        fontWeight="700"
        textAnchor={textAnchor}
        dominantBaseline="central"
      >
        {`${name}: ${fmtInt(value)}`}
      </text>
    </g>
  );
}

function renderBarValueLabelWithColor(color) {
  return (props) => renderBarValueLabel({ ...props, color });
}

function normalizeProvinceName(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ');

  if (normalized === 'baguio') return 'baguio city';
  if (normalized === 'mt province') return 'mountain province';

  return normalized;
}

const PROVINCE_NAME_LOOKUP = new Map(
  CAR_PROVINCES.map((province) => [normalizeProvinceName(province), province])
);

function normalizeAdsdppEdition(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ');

  if (!normalized) return '';
  if (normalized.startsWith('1') || normalized.includes('first')) return 'firstEdition';
  if (normalized.startsWith('2') || normalized.includes('second')) return 'secondEdition';

  return '';
}

const PIE_COLORS = ['#586136', '#878855', '#c3a479', '#b55535'];
const PROVINCE_DOT_COLORS = ['#dcd7cd', '#586136', '#878855', '#c3a479', '#9c8f6a', '#b55535', '#343017'];
const MAP_STYLE_VERSION = 'province-only-v2';
const MAP_OUTLINE_COLOR = '#ffffff';
const PROVINCE_MAP_COLORS = {
  abra: '#dcd7cd',
  apayao: '#586136',
  'baguio city': '#878855',
  benguet: '#c3a479',
  ifugao: '#9c8f6a',
  kalinga: '#b55535',
  'mountain province': '#343017',
};

function getProvinceMapColor(value) {
  return PROVINCE_MAP_COLORS[normalizeProvinceName(value)] || '#878855';
}

function ProvinceAxisTick({ x, y, payload, index, formatValue, data }) {
  const row = data[index];

  return (
    <g transform={`translate(${x - 214}, ${y})`}>
      <circle
        cx={6}
        cy={0}
        r={4}
        fill={PROVINCE_DOT_COLORS[index % PROVINCE_DOT_COLORS.length]}
      />
      <text x={20} y={1} fill="#55607a" fontSize="11" dominantBaseline="middle">
        {payload.value}
      </text>
      <text x={196} y={1} fill="#55607a" fontSize="11" textAnchor="end" dominantBaseline="middle">
        {formatValue(row?.value ?? 0)}
      </text>
    </g>
  );
}

function ProvinceHorizontalChart({ title, data, color, formatValue, className = '', isAnimationActive = true }) {
  return (
    <div className={`chart-wrap province-compare-card ${className}`.trim()}>
      <div className="province-compare-header">
        <h3 className="summary-subtitle">{title}</h3>
      </div>
      <div className="province-compare-layout">
        <div className="province-compare-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 10, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dcd7cd" horizontal={false} />
              <XAxis type="number" axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                width={220}
                tick={<ProvinceAxisTick formatValue={formatValue} data={data} />}
              />
              <Tooltip formatter={(value) => [formatValue(value), title]} />
              <Bar
                dataKey="value"
                fill={color}
                radius={[0, 4, 4, 0]}
                barSize={13}
                isAnimationActive={isAnimationActive}
              >
                {data.map((row, index) => (
                  <Cell key={row.name} fill={PROVINCE_DOT_COLORS[index % PROVINCE_DOT_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function CoverageMapViewport({ geoJson }) {
  const map = useMap();

  useEffect(() => {
    if (!geoJson?.features?.length) return;

    const layer = new L.GeoJSON(geoJson);
    const bounds = layer.getBounds();

    if (!bounds.isValid()) return;

    map.fitBounds(bounds, {
      padding: [28, 28],
      maxZoom: 8,
    });
  }, [geoJson, map]);

  return null;
}

export default function Summaries() {
  const { records } = useData();
  const [coverageGeoJson, setCoverageGeoJson] = useState(null);
  const [mapError, setMapError] = useState('');
  const [exportingImage, setExportingImage] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState('');
  const dashboardRef = useRef(null);
  const isExporting = exportingImage || exportingPdf;

  useEffect(() => {
    let isMounted = true;
    fetch(`${process.env.PUBLIC_URL || ''}/province-outlines.geojson`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!isMounted) return;
        setCoverageGeoJson(json);
        setMapError('');
      })
      .catch(() => {
        if (!isMounted) return;
        setCoverageGeoJson(null);
        setMapError('Could not load coverage map data.');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const data = useMemo(() => {
    const byProvince = CAR_PROVINCES.reduce((acc, province) => {
      acc[province] = {
        province,
        numberAds: 0,
        totalArea: 0,
        approvedRegistered: 0,
        approvedUnregistered: 0,
        approvedTotal: 0,
        onProcess: 0,
        withApplication: 0,
        withoutApplication: 0,
        forProcessingTotal: 0,
        indicativeMaps: 0,
        rightHolders: 0,
        approvedCadt: 0,
        ongoingCadt: 0,
        formulatedAdsdpp: 0,
        ongoingFormulation: 0,
        firstEdition: 0,
        secondEdition: 0,
      };
      return acc;
    }, {});

    const totals = {
      numberAds: 0,
      totalArea: 0,
      approvedRegistered: 0,
      approvedUnregistered: 0,
      approvedTotal: 0,
      onProcess: 0,
      withApplication: 0,
      withoutApplication: 0,
      forProcessingTotal: 0,
      indicativeMaps: 0,
      rightHolders: 0,
      approvedCadt: 0,
      ongoingCadt: 0,
      formulatedAdsdpp: 0,
      ongoingFormulation: 0,
      firstEdition: 0,
      secondEdition: 0,
    };

    let withCadt = 0;
    let ongoing = 0;
    let forProcessing = 0;

    records.forEach((record) => {
      const province = PROVINCE_NAME_LOOKUP.get(normalizeProvinceName(record.province)) || null;
      const category = toCategory(record.category);
      const isRegistered = category === 'registered';
      const isUnregistered = category === 'unregistered';
      const isOngoingCategory = category === 'ongoing';
      const isWithApplicationCategory = category === 'with application';
      const isWithoutApplicationCategory = category === 'without application';
      const hasMap = !!record.withIndicativeMap;
      const hasCadt = hasValue(record.cadtNo);
      const hasAdsdpp = !!record.withAdsdpp;
      const adsdppEdition = normalizeAdsdppEdition(record.adsdppEdition);
      const area = asAreaNumber(record.areaHas);
      const rightHolders = asNumber(record.noBeneficiaries);
      const isApproved = hasCadt || isRegistered || isUnregistered;
      const isOngoing = !isApproved && isOngoingCategory;
      const isWithApplication = !isApproved && !isOngoing && isWithApplicationCategory;
      const isWithoutApplication = !isApproved && !isOngoing && isWithoutApplicationCategory;

      totals.numberAds += 1;
      totals.totalArea += area;
      totals.rightHolders += rightHolders;
      if (isApproved) totals.approvedCadt += 1;
      if (isOngoing) totals.ongoingCadt += 1;
      if (hasAdsdpp) totals.formulatedAdsdpp += 1;
      if (!hasAdsdpp) totals.ongoingFormulation += 1;
      if (adsdppEdition === 'firstEdition') totals.firstEdition += 1;
      if (adsdppEdition === 'secondEdition') totals.secondEdition += 1;
      if (isRegistered) totals.approvedRegistered += 1;
      if (isUnregistered) totals.approvedUnregistered += 1;
      if (isOngoing) totals.onProcess += 1;
      if (isWithApplication) totals.withApplication += 1;
      if (isWithoutApplication) totals.withoutApplication += 1;
      if (hasMap) totals.indicativeMaps += 1;

      if (isApproved) withCadt += 1;
      if (isOngoing) ongoing += 1;
      if (isWithApplication || isWithoutApplication) forProcessing += 1;

      if (!province) return;
      const row = byProvince[province];
      row.numberAds += 1;
      row.totalArea += area;
      row.rightHolders += rightHolders;
      if (isApproved) row.approvedCadt += 1;
      if (isOngoing) row.ongoingCadt += 1;
      if (hasAdsdpp) row.formulatedAdsdpp += 1;
      if (!hasAdsdpp) row.ongoingFormulation += 1;
      if (adsdppEdition === 'firstEdition') row.firstEdition += 1;
      if (adsdppEdition === 'secondEdition') row.secondEdition += 1;
      if (isRegistered) row.approvedRegistered += 1;
      if (isUnregistered) row.approvedUnregistered += 1;
      if (isOngoing) row.onProcess += 1;
      if (isWithApplication) row.withApplication += 1;
      if (isWithoutApplication) row.withoutApplication += 1;
      if (hasMap) row.indicativeMaps += 1;
    });

    totals.approvedTotal = totals.approvedCadt;
    totals.forProcessingTotal = totals.withApplication + totals.withoutApplication;

    const matrixRows = CAR_PROVINCES.map((province) => {
      const row = byProvince[province];
      row.approvedTotal = row.approvedCadt;
      row.forProcessingTotal = row.withApplication + row.withoutApplication;
      return row;
    });

    const noStatus = Math.max(0, totals.numberAds - (withCadt + ongoing + forProcessing));
    const adsdppRows = matrixRows.map((row) => ({
      province: row.province,
      approvedCadt: row.approvedCadt,
      ongoingCadt: row.ongoingCadt,
      formulatedAdsdpp: row.formulatedAdsdpp,
      ongoingFormulation: row.ongoingFormulation,
      firstEdition: row.firstEdition,
      secondEdition: row.secondEdition,
    }));
    const adsdppTotals = adsdppRows.reduce(
      (acc, row) => ({
        approvedCadt: acc.approvedCadt + row.approvedCadt,
        ongoingCadt: acc.ongoingCadt + row.ongoingCadt,
        formulatedAdsdpp: acc.formulatedAdsdpp + row.formulatedAdsdpp,
        ongoingFormulation: acc.ongoingFormulation + row.ongoingFormulation,
      }),
      {
        approvedCadt: 0,
        ongoingCadt: 0,
        formulatedAdsdpp: 0,
        ongoingFormulation: 0,
      }
    );

    return {
      summary: {
        withCadt,
        ongoing,
        forProcessing,
        total: totals.numberAds,
        noStatus,
      },
      matrixRows,
      totals,
      adsdppRows,
      adsdppTotals,
      chartAdsVsApprovedPerProvince: matrixRows.map((row) => ({
        name: row.province,
        ads: row.numberAds,
        approved: row.approvedTotal,
      })),
      chartStatusPerProvince: matrixRows.map((row) => ({
        name: row.province,
        unregistered: row.approvedUnregistered,
        ongoing: row.onProcess,
        withApplication: row.withApplication,
      })),
      chartAreaPerProvince: matrixRows.map((row) => ({ name: row.province, value: Number(row.totalArea.toFixed(2)) })),
      chartProcessingStatus: [
        { name: 'With CADT', value: withCadt },
        { name: 'Ongoing', value: ongoing },
        { name: 'For Processing', value: forProcessing },
        { name: 'No Status', value: noStatus },
      ],
      chartAdsdppFormulatedPerProvince: adsdppRows.map((row) => ({ name: row.province, value: row.formulatedAdsdpp })),
      chartAdsdppProgress: adsdppRows.map((row) => ({
        name: row.province,
        formulated: row.formulatedAdsdpp,
        ongoing: row.ongoingFormulation,
      })),
      chartAdsdppEditionPerProvince: adsdppRows.map((row) => ({
        name: row.province,
        firstEdition: row.firstEdition,
        secondEdition: row.secondEdition,
      })),
    };
  }, [records]);

  const provinceSummaryMap = useMemo(
    () =>
      new Map(
        data.matrixRows.map((row) => [
          normalizeProvinceName(row.province),
          {
            numberAds: row.numberAds,
            totalArea: row.totalArea,
            rightHolders: row.rightHolders,
            approvedTotal: row.approvedTotal,
            forProcessingTotal: row.forProcessingTotal,
            indicativeMaps: row.indicativeMaps,
          },
        ])
      ),
    [data.matrixRows]
  );

  const insightStats = [
    { label: 'Number of ADs', value: fmtInt(data.totals.numberAds) },
    { label: 'Total Area', value: fmtArea(data.totals.totalArea) },
    { label: 'Indicative Maps', value: fmtInt(data.totals.indicativeMaps) },
    { label: 'Approved CADT', value: fmtInt(data.totals.approvedCadt) },
    { label: 'ADSDPP Formulated', value: fmtInt(data.totals.formulatedAdsdpp) },
  ];

  async function waitForDashboardStability() {
    if (document.fonts?.ready) {
      await document.fonts.ready.catch(() => {});
    }

    await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
    await new Promise((resolve) => window.setTimeout(resolve, 120));
  }

  async function captureDashboardImage() {
    if (!dashboardRef.current) return null;
    const dashboardNode = dashboardRef.current;
    const tableWraps = Array.from(dashboardNode.querySelectorAll('.summary-table-wrap'));
    const tables = Array.from(dashboardNode.querySelectorAll('.summary-table'));
    await waitForDashboardStability();

    const dashboardRect = dashboardNode.getBoundingClientRect();
    const contentNodes = Array.from(
      dashboardNode.querySelectorAll(
        '.summary-section, .chart-wrap, .province-compare-card, .insight-stat-card, .summary-table-wrap, .summary-table, .map-wrap'
      )
    );
    const contentRightEdge = contentNodes.reduce((maxRight, node) => {
      const { right } = node.getBoundingClientRect();
      return Math.max(maxRight, right - dashboardRect.left);
    }, dashboardRect.width);
    const contentBottomEdge = contentNodes.reduce((maxBottom, node) => {
      const { bottom } = node.getBoundingClientRect();
      return Math.max(maxBottom, bottom - dashboardRect.top);
    }, dashboardRect.height);
    const exportPadding = 24;
    const exportWidth = Math.max(
      Math.ceil(dashboardRect.width),
      Math.ceil(dashboardNode.scrollWidth),
      Math.ceil(contentRightEdge + exportPadding),
      ...tableWraps.map((wrap) => wrap.scrollWidth),
      ...tables.map((table) => table.scrollWidth)
    );
    const exportHeight = Math.max(
      Math.ceil(dashboardNode.scrollHeight),
      Math.ceil(contentBottomEdge + exportPadding)
    );

    const dataUrl = await toPng(dashboardNode, {
      cacheBust: true,
      pixelRatio: Math.max(2, Math.min(3, window.devicePixelRatio || 1)),
      backgroundColor: '#fffaf7',
      width: exportWidth,
      height: exportHeight,
      style: {
        boxSizing: 'border-box',
        overflow: 'visible',
        maxWidth: 'none',
        width: `${exportWidth}px`,
        minWidth: `${exportWidth}px`,
      },
      filter: (node) => !(node instanceof HTMLElement && node.dataset.exportIgnore === 'true'),
    });

    return { dataUrl, exportWidth, exportHeight };
  }

  async function handleExportDashboardImage() {
    if (!dashboardRef.current || exportingImage || exportingPdf) return;

    setExportingImage(true);
    setExportError('');

    try {
      const capture = await captureDashboardImage();
      if (!capture) return;
      const { dataUrl } = capture;
      const link = document.createElement('a');
      const stamp = getExportStamp();
      link.download = `car-dashboard-photo-${stamp}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      setExportError('Could not export dashboard as image. Please try again.');
    } finally {
      setExportingImage(false);
    }
  }

  async function handleExportDashboardPdf() {
    if (!dashboardRef.current || exportingImage || exportingPdf) return;

    setExportingPdf(true);
    setExportError('');

    try {
      const capture = await captureDashboardImage();
      if (!capture) return;

      const { dataUrl, exportWidth, exportHeight } = capture;
      const stamp = getExportStamp();
      const pdf = new jsPDF({
        orientation: exportWidth > exportHeight ? 'landscape' : 'portrait',
        unit: 'px',
        format: 'a4',
        hotfixes: ['px_scaling'],
        compress: true,
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const pageMargin = 18;
      const usablePageWidth = pageWidth - pageMargin * 2;
      const usablePageHeight = pageHeight - pageMargin * 2;
      const scaledHeight = (exportHeight * usablePageWidth) / exportWidth;

      let remainingHeight = scaledHeight;
      let offsetY = pageMargin;

      pdf.setProperties({
        title: 'CAR Dashboard Summary',
        subject: 'Cordillera Ancestral Domains dashboard export',
      });
      pdf.addImage(dataUrl, 'PNG', pageMargin, offsetY, usablePageWidth, scaledHeight, undefined, 'FAST');
      remainingHeight -= usablePageHeight;

      while (remainingHeight > 0) {
        offsetY -= usablePageHeight;
        pdf.addPage();
        pdf.addImage(dataUrl, 'PNG', pageMargin, offsetY, usablePageWidth, scaledHeight, undefined, 'FAST');
        remainingHeight -= usablePageHeight;
      }

      pdf.save(`car-dashboard-report-${stamp}.pdf`);
    } catch (error) {
      setExportError('Could not export dashboard as PDF. Please try again.');
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div
      className={`summaries-page${isExporting ? ' is-exporting-image' : ''}`}
      ref={dashboardRef}
    >
      <header className="summaries-header">
        <div className="summaries-header-top">
          <div>
            <h1>Dashboard</h1>
            <p>Overview of Cordillera Ancestral Domains data</p>
          </div>
          <div className="dashboard-export-actions" data-export-ignore="true">
            <button
              type="button"
              className="dashboard-export-button dashboard-export-button-secondary"
              onClick={handleExportDashboardPdf}
              disabled={exportingImage || exportingPdf}
            >
              {exportingPdf ? 'Exporting PDF...' : 'Export PDF'}
            </button>
            <button
              type="button"
              className="dashboard-export-button"
              onClick={handleExportDashboardImage}
              disabled={exportingImage || exportingPdf}
            >
              {exportingImage ? 'Exporting Photo...' : 'Export Photo'}
            </button>
          </div>
        </div>
        {exportError && (
          <p className="dashboard-export-error" data-export-ignore="true">
            {exportError}
          </p>
        )}
      </header>

      <section className="summary-section">
        <div className="dashboard-top-layout">
          <div className="summary-table-wrap full">
            <table className="summary-table matrix">
              <thead>
                <tr>
                  <th rowSpan={2}>Province</th>
                  <th rowSpan={2}>Number of ADs</th>
                  <th rowSpan={2}>Total Area</th>
                  <th colSpan={3}>Approved CADTs</th>
                  <th rowSpan={2}>On Process</th>
                  <th colSpan={2}>For Processing</th>
                  <th rowSpan={2}>Indicative Maps</th>
                </tr>
                <tr>
                  <th>Registered</th>
                  <th>Unregistered</th>
                  <th>Total</th>
                  <th>With</th>
                  <th>Without</th>
                </tr>
              </thead>
              <tbody>
                {data.matrixRows.map((row) => (
                  <tr key={row.province}>
                    <td>{row.province}</td>
                    <td>{fmtInt(row.numberAds)}</td>
                    <td>{fmtArea(row.totalArea)}</td>
                    <td>{fmtInt(row.approvedRegistered)}</td>
                    <td>{fmtInt(row.approvedUnregistered)}</td>
                    <td className="accent">{fmtInt(row.approvedTotal)}</td>
                    <td>{fmtInt(row.onProcess)}</td>
                    <td>{fmtInt(row.withApplication)}</td>
                    <td>{fmtInt(row.withoutApplication)}</td>
                    <td>{fmtInt(row.indicativeMaps)}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td>Total</td>
                  <td>{fmtInt(data.totals.numberAds)}</td>
                  <td>{fmtArea(data.totals.totalArea)}</td>
                  <td>{fmtInt(data.totals.approvedRegistered)}</td>
                  <td>{fmtInt(data.totals.approvedUnregistered)}</td>
                  <td className="accent">{fmtInt(data.totals.approvedTotal)}</td>
                  <td>{fmtInt(data.totals.onProcess)}</td>
                  <td>{fmtInt(data.totals.withApplication)}</td>
                  <td>{fmtInt(data.totals.withoutApplication)}</td>
                  <td>{fmtInt(data.totals.indicativeMaps)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </section>

      <section className="summary-section insights-section">
        <div className="insights-layout">
          <div className="insights-map-card">
            <div className="map-wrap insights-map-wrap">
              <MapContainer center={[17.6, 120.75]} zoom={8} className="summary-map" scrollWheelZoom>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {coverageGeoJson && <CoverageMapViewport geoJson={coverageGeoJson} />}
                {coverageGeoJson && (
                  <GeoJSON
                    key={`coverage-${MAP_STYLE_VERSION}-${data.totals.numberAds}-${data.totals.totalArea}-${data.totals.rightHolders}`}
                    data={coverageGeoJson}
                    style={(feature) => {
                      const provinceName = feature?.properties?.province || '';
                      const fillColor = getProvinceMapColor(provinceName);
                      return {
                        color: MAP_OUTLINE_COLOR,
                        weight: 3,
                        fillColor,
                        fillOpacity: 0.42,
                      };
                    }}
                    onEachFeature={(feature, layer) => {
                      const props = feature.properties || {};
                      const provinceName = props.province || 'Coverage';
                      const provinceSummary = provinceSummaryMap.get(normalizeProvinceName(provinceName));
                      const popupHtml = `
                        <div class="map-popup">
                        <strong>${provinceName}</strong><br/>
                        Municipality: ${props.municipality || 'N/A'}<br/>
                        Coverage: ${props.coverage || 'N/A'}<br/>
                        Total Area: ${provinceSummary ? fmtArea(provinceSummary.totalArea) : '0.00'} Has<br/>
                        Approved CADTs: ${provinceSummary ? fmtInt(provinceSummary.approvedTotal) : '0'}<br/>
                        For Processing: ${provinceSummary ? fmtInt(provinceSummary.forProcessingTotal) : '0'}<br/>
                        Indicative Maps: ${provinceSummary ? fmtInt(provinceSummary.indicativeMaps) : '0'}
                        </div>
                      `;
                      layer.bindPopup(popupHtml);
                      layer.bindTooltip(`<span class="map-outline-label-text">${provinceName}</span>`, {
                        permanent: true,
                        direction: 'center',
                        className: 'map-outline-label',
                        opacity: 1,
                      });
                    }}
                  />
                )}
              </MapContainer>
            </div>
            {mapError && <p className="figure-error">{mapError}</p>}
          </div>

          <div className="insights-main">
            <div className="chart-wrap province-compare-card insights-chart-card">
              <div className="province-compare-header">
                <h3 className="summary-subtitle">Unregistered, Ongoing, and With Application</h3>
              </div>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={data.chartStatusPerProvince} margin={{ top: 20, right: 18, left: -6, bottom: 6 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dcd7cd" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-22} textAnchor="end" height={64} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip formatter={formatCountTooltip} />
                  <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 0 }} />
                  <Bar
                    dataKey="unregistered"
                    name="Unregistered"
                    fill="#b55535"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={!isExporting}
                  >
                    <LabelList dataKey="unregistered" content={renderBarValueLabelWithColor('#b55535')} />
                  </Bar>
                  <Bar
                    dataKey="ongoing"
                    name="Ongoing"
                    fill="#878855"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={!isExporting}
                  >
                    <LabelList dataKey="ongoing" content={renderBarValueLabelWithColor('#878855')} />
                  </Bar>
                  <Bar
                    dataKey="withApplication"
                    name="With Application"
                    fill="#c3a479"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={!isExporting}
                  >
                    <LabelList dataKey="withApplication" content={renderBarValueLabelWithColor('#c3a479')} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <ProvinceHorizontalChart
              title="Area per Province"
              data={data.chartAreaPerProvince}
              color="#586136"
              formatValue={fmtArea}
              isAnimationActive={!isExporting}
            />
          </div>

          <div className="insights-stats">
            {insightStats.map((stat) => (
              <div className="insight-stat-card" key={stat.label}>
                <strong className="insight-stat-value" aria-hidden="true">
                  {stat.value}
                </strong>
                <div className="insight-stat-copy">
                  <span>{stat.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-grid insights-bottom-grid">
          <div className="chart-panel">
            <div className="chart-wrap status-chart-card">
              <h3 className="summary-subtitle">Processing Status</h3>
              <div className="status-chart-inner">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart margin={{ top: 4, right: 28, bottom: 6, left: 28 }}>
                    <Pie
                      data={data.chartProcessingStatus}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={64}
                      outerRadius={108}
                      labelLine={false}
                      label={renderPieCalloutLabel}
                      isAnimationActive={!isExporting}
                    >
                      {data.chartProcessingStatus.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={formatCountTooltip} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="status-chart-total" aria-hidden="true">
                  <span>Total</span>
                  <strong>{fmtInt(data.summary.total)}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="chart-panel">
            <div className="chart-wrap province-compare-card">
              <div className="province-compare-header">
                <h3 className="summary-subtitle">ADs and Approved CADTs per Province</h3>
              </div>
              <div className="province-compare-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.chartAdsVsApprovedPerProvince} margin={{ top: 12, right: 18, left: 0, bottom: 42 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dcd7cd" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-22} textAnchor="end" height={64} />
                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                    <Tooltip formatter={formatCountTooltip} />
                    <Legend />
                    <Bar dataKey="ads" name="ADs" fill="#586136" radius={[4, 4, 0, 0]} isAnimationActive={!isExporting}>
                      <LabelList dataKey="ads" content={renderBarValueLabelWithColor('#586136')} />
                    </Bar>
                    <Bar
                      dataKey="approved"
                      name="Approved CADTs"
                      fill="#b55535"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={!isExporting}
                    >
                      <LabelList dataKey="approved" content={renderBarValueLabelWithColor('#b55535')} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="summary-section adsdpp-section">
        <h2>ADSDPP</h2>
        <div className="chart-grid adsdpp-overview-grid">
          <div className="chart-panel">
            <div className="summary-table-wrap full">
              <table className="summary-table matrix adsdpp-matrix">
                <thead>
                  <tr>
                    <th>Province</th>
                    <th>Formulated ADSDPP</th>
                    <th>Ongoing Formulation</th>
                  </tr>
                </thead>
                <tbody>
                  {data.adsdppRows.map((row) => (
                    <tr key={row.province}>
                      <td>{row.province}</td>
                      <td className="accent">{fmtInt(row.formulatedAdsdpp)}</td>
                      <td>{fmtInt(row.ongoingFormulation)}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td>Total</td>
                    <td className="accent">{fmtInt(data.adsdppTotals.formulatedAdsdpp)}</td>
                    <td>{fmtInt(data.adsdppTotals.ongoingFormulation)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="chart-panel">
            <ProvinceHorizontalChart
              title="ADSDPP Formulated per Province"
              data={data.chartAdsdppFormulatedPerProvince}
              color="#878855"
              formatValue={fmtInt}
              className="adsdpp-province-chart"
              isAnimationActive={!isExporting}
            />
          </div>
        </div>

        <div className="chart-grid insights-bottom-grid">
          <div className="chart-panel">
            <div className="chart-wrap province-compare-card">
              <div className="province-compare-header">
                <h3 className="summary-subtitle">Edition per Province</h3>
              </div>
              <div className="province-compare-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.chartAdsdppEditionPerProvince} margin={{ top: 22, right: 18, left: 0, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dcd7cd" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-16} textAnchor="end" height={52} tickMargin={6} />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={formatCountTooltip} />
                    <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 8 }} />
                    <Bar
                      dataKey="firstEdition"
                      name="1st Edition"
                      fill="#586136"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={!isExporting}
                    >
                      <LabelList dataKey="firstEdition" content={renderBarValueLabelWithColor('#586136')} />
                    </Bar>
                    <Bar
                      dataKey="secondEdition"
                      name="2nd Edition"
                      fill="#c3a479"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={!isExporting}
                    >
                      <LabelList dataKey="secondEdition" content={renderBarValueLabelWithColor('#c3a479')} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="chart-panel">
            <div className="chart-wrap province-compare-card">
              <h3 className="summary-subtitle">ADSDPP Progress</h3>
              <div className="province-compare-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.chartAdsdppProgress} margin={{ top: 36, right: 18, left: 0, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dcd7cd" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-16} textAnchor="end" height={52} tickMargin={6} />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={formatCountTooltip} />
                    <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 8 }} />
                    <Bar
                      dataKey="formulated"
                      stackId="adsdpp"
                      fill="#586136"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={!isExporting}
                    >
                      <LabelList dataKey="formulated" content={renderBarValueLabelWithColor('#586136')} />
                    </Bar>
                    <Bar dataKey="ongoing" stackId="adsdpp" fill="#c3a479" isAnimationActive={!isExporting}>
                      <LabelList dataKey="ongoing" content={renderBarValueLabelWithColor('#c3a479')} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
