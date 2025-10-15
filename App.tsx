import React, { useState, useEffect, useCallback, useMemo } from 'react';

// --- TYPES ---
interface Option {
    key: string;
    label: string;
    color?: string;
    color_factor?: number;
    lottieFile?: string;
    sound?: string;
}

interface ContentItem {
    key: string;
    centerLabel?: string;
    label?: string; // For options
    is_menu?: boolean;
    options?: Option[];
    primaryLabelRotation?: boolean;
    primaryLabelOffset?: number;
    primaryPixelSize?: number;
    hasIcon?: boolean;
    icons?: string[];
    fontColor?: string;
    color?: string; // For menus
    color_factor?: number; // For options
    is_video?: boolean;
    videoSource?: string;
    is_audio?: boolean;
    audioSource?: string;
    is_lottie?: boolean;
    lottieSource?: string;
    is_setting?: boolean;
    [key: string]: any; 
}

interface TreeNodeData extends ContentItem {
    children: TreeNodeData[];
    parentKey: string | null;
    displayColor: string;
}

type EditState = {
    mode: 'add' | 'edit';
    item: ContentItem;
    parentKey: string | null;
} | null;

// --- ICONS ---
const PlusIcon = ({ size = 6 }: {size?: number}) => (<svg xmlns="http://www.w3.org/2000/svg" className={`h-${size} w-${size}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>);
const PencilIcon = ({ size = 6 }: {size?: number}) => (<svg xmlns="http://www.w3.org/2000/svg" className={`h-${size} w-${size}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>);
const TrashIcon = ({ size = 6 }: {size?: number}) => (<svg xmlns="http://www.w3.org/2000/svg" className={`h-${size} w-${size}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>);
const ChevronRightIcon = ({ open }: { open: boolean }) => (<svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transform transition-transform ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>);
const UploadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>;
const DownloadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>;
const ArrowLeftIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>;

// --- UTILITY FUNCTIONS ---
const adjustColor = (color: string, factor?: number): string => {
    if (!color || typeof factor !== 'number' || !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) return color || '#cccccc';
    
    let r = parseInt(color.slice(1, 3), 16);
    let g = parseInt(color.slice(3, 5), 16);
    let b = parseInt(color.slice(5, 7), 16);

    const darken = (val: number) => Math.max(0, Math.min(255, Math.floor(val / factor)));

    r = darken(r);
    g = darken(g);
    b = darken(b);

    const toHex = (c: number) => ('0' + c.toString(16)).slice(-2);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const generateKey = (label: string, allKeys: Set<string>): string => {
    let baseKey = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!baseKey) baseKey = 'new_item';
    let key = baseKey;
    let counter = 1;
    while (allKeys.has(key)) {
        key = `${baseKey}_${counter}`;
        counter++;
    }
    return key;
};

const deepModifyFlow = (flow: any, parentKey: string, modification: (children: any) => any): any => {
    if (typeof flow !== 'object' || flow === null) return flow;
    const newFlow = { ...flow };
    for (const key in newFlow) {
        if (key === parentKey) {
            newFlow[key] = modification(newFlow[key]);
            return newFlow;
        }
        if (typeof newFlow[key] === 'object') {
            const result = deepModifyFlow(newFlow[key], parentKey, modification);
            if (result !== newFlow[key]) {
                newFlow[key] = result;
                return newFlow;
            }
        }
    }
    return newFlow;
};

const deepReplaceKey = (obj: any, oldKey: string, newKey: string): any => {
    if (Array.isArray(obj)) {
        return obj.map(item => (item === oldKey ? newKey : item));
    }
    if (typeof obj === 'object' && obj !== null) {
        return Object.keys(obj).reduce((acc, key) => {
            const newPropertyName = key === oldKey ? newKey : key;
            acc[newPropertyName] = deepReplaceKey(obj[key], oldKey, newKey);
            return acc;
        }, {} as any);
    }
    return obj;
};

const getDescendantKeys = (flowNode: any, key: string): Set<string> => {
    const keys = new Set<string>();
    const queue: any[] = [flowNode[key]];
    keys.add(key);

    while (queue.length > 0) {
        const current = queue.shift();
        if (Array.isArray(current)) {
            current.forEach(k => keys.add(k));
        } else if (typeof current === 'object' && current !== null) {
            Object.keys(current).forEach(k => {
                keys.add(k);
                queue.push(current[k]);
            });
        }
    }
    return keys;
};


const buildTreeFromFlow = (flowData: any, contentMap: Map<string, ContentItem>): TreeNodeData[] => {
    const build = (node: any, parentKey: string | null, parentDisplayColor: string): TreeNodeData[] => {
        if (Array.isArray(node)) {
             return node.map(key => {
                const item = contentMap.get(key);
                const parentItem = parentKey ? contentMap.get(parentKey) : null;
                const optionInParent = parentItem?.options?.find(opt => opt.key === key);
                const calculatedColor = adjustColor(parentDisplayColor, optionInParent?.color_factor);
                return {
                    ...(item || { key }),
                    key,
                    children: [],
                    parentKey,
                    displayColor: calculatedColor,
                };
            });
        }
        if (typeof node === 'object' && node !== null) {
            return Object.keys(node).map(key => {
                const item = contentMap.get(key);
                const parentItem = parentKey ? contentMap.get(parentKey) : null;

                const optionInParent = parentItem?.options?.find(opt => opt.key === key);
                const displayColor = optionInParent?.color || item?.color || '#cccccc';

                const children = build(node[key], key, displayColor);

                return {
                    ...(item || { key }),
                    key,
                    children,
                    parentKey,
                    displayColor: displayColor,
                };
            });
        }
        return [];
    };
    return build(flowData, null, '#000000');
};


// --- MODAL COMPONENT ---
interface ItemModalProps {
    editState: EditState;
    onClose: () => void;
    onSave: (item: ContentItem, parentKey: string | null) => void;
    allKeys: Set<string>;
}

const ItemModal: React.FC<ItemModalProps> = ({ editState, onClose, onSave, allKeys }) => {
    const [item, setItem] = useState<ContentItem>({ key: '' });
    const [keyError, setKeyError] = useState<string | null>(null);

    useEffect(() => {
        if (editState) {
            if (editState.mode === 'add') {
                const initialLabel = 'New Item';
                const initialKey = generateKey(initialLabel, allKeys);
                setItem({ key: initialKey, label: initialLabel });
            } else {
                setItem(editState.item);
            }
        }
    }, [editState, allKeys]);

    if (!editState) return null;
    
    const { mode, parentKey } = editState;
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        
        let newItem = { ...item };
        if (e.target instanceof HTMLInputElement && e.target.type === 'checkbox') {
            newItem = { ...newItem, [name]: e.target.checked };
        } else {
            newItem = { ...newItem, [name]: value };
        }

        if (name === 'label' && mode === 'add') {
            const newKey = generateKey(value, allKeys);
            newItem.key = newKey;
            setKeyError(null);
        }

        setItem(newItem);

        if (name === 'key') {
            const originalKey = editState?.item?.key || '';
            if (value !== originalKey && allKeys.has(value)) setKeyError('Key must be unique.');
            else if (!value) setKeyError('Key is required.');
            else setKeyError(null);
        }
    };
    
    const handleSave = () => {
        if (keyError || !item.key) {
            if (!item.key) setKeyError('Key is required.');
            if (keyError) setKeyError('Key must be unique.');
            return;
        }
        onSave(item, parentKey);
        onClose();
    };

    const renderField = (fieldName: keyof ContentItem, label: string, type: 'text' | 'textarea' | 'number' | 'checkbox' = 'text') => (
        <div>
            <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor={String(fieldName)}>{label}</label>
            {type === 'textarea' ? ( <textarea id={String(fieldName)} name={String(fieldName)} value={item[fieldName] ?? ''} onChange={handleChange} className="shadow appearance-none border rounded w-full py-2 px-3 bg-gray-700 border-gray-600 text-gray-200 leading-tight focus:outline-none focus:shadow-outline" /> ) : type === 'checkbox' ? ( <input id={String(fieldName)} name={String(fieldName)} type="checkbox" checked={!!item[fieldName]} onChange={handleChange} className="mr-2 leading-tight h-5 w-5 rounded bg-gray-600 border-gray-500 focus:ring-blue-500" /> ) : ( <input id={String(fieldName)} name={String(fieldName)} type={type} value={item[fieldName] ?? ''} onChange={handleChange} className="shadow appearance-none border rounded w-full py-2 px-3 bg-gray-700 border-gray-600 text-gray-200 leading-tight focus:outline-none focus:shadow-outline" /> )}
        </div>
    );
    
    const getItemType = () => {
        if (item.is_menu) return 'menu';
        if (item.is_video) return 'video';
        if (item.is_audio) return 'audio';
        if (item.is_lottie) return 'lottie';
        return 'none';
    };
    
    const handleTypeChange = (type: string) => {
        setItem(prev => {
            const newItem: ContentItem = { key: prev.key, centerLabel: prev.centerLabel, label: (prev as any).label };
            switch (type) {
                case 'menu': newItem.is_menu = true; newItem.options = prev.options || []; break;
                case 'video': newItem.is_video = true; break;
                case 'audio': newItem.is_audio = true; break;
                case 'lottie': newItem.is_lottie = true; break;
            }
            return newItem;
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-bold mb-4 text-white capitalize">{mode} Item</h2>
                <div className="space-y-4">
                    {parentKey !== null && renderField('label', 'Label (as option in parent)', 'textarea')}
                    {item.is_menu && renderField('centerLabel', 'Center Label (as menu title)', 'textarea')}
                     
                     <div>
                        <label className="block text-gray-400 text-sm font-bold mb-2">Key</label>
                        <input name="key" value={item.key} onChange={handleChange} className={`shadow appearance-none border rounded w-full py-2 px-3 bg-gray-700 border-gray-600 text-gray-200 leading-tight focus:outline-none focus:shadow-outline ${keyError ? 'border-red-500' : ''}`} />
                        {keyError && <p className="text-red-500 text-xs italic mt-1">{keyError}</p>}
                    </div>

                     <div>
                        <label className="block text-gray-400 text-sm font-bold mb-2">Item Type</label>
                        <select value={getItemType()} onChange={(e) => handleTypeChange(e.target.value)} className="shadow appearance-none border rounded w-full py-2 px-3 bg-gray-700 border-gray-600 text-gray-200 leading-tight focus:outline-none focus:shadow-outline">
                            <option value="none">None</option><option value="menu">Menu</option><option value="video">Video</option><option value="audio">Audio</option><option value="lottie">Lottie</option>
                        </select>
                    </div>
                    
                    {getItemType() === 'menu' && (<>{renderField('primaryLabelRotation', 'Primary Label Rotation', 'checkbox')}{renderField('primaryLabelOffset', 'Primary Label Offset', 'number')}{renderField('primaryPixelSize', 'Primary Pixel Size', 'number')}</>)}
                    {getItemType() === 'video' && renderField('videoSource', 'Video Filename')}
                    {getItemType() === 'audio' && renderField('audioSource', 'Audio Filename')}
                    {getItemType() === 'lottie' && renderField('lottieSource', 'Lottie Filename')}
                    
                    {item.is_menu || parentKey !== null ? (
                        <div>
                            <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="color">Color</label>
                            <div className="flex items-center">
                                <input id="color" name="color" type="color" value={item.color || '#000000'} onChange={handleChange} className="p-0 h-10 w-10 block bg-gray-700 border-gray-600 cursor-pointer rounded-lg appearance-none" />
                                <input type="text" value={item.color || ''} onChange={handleChange} name="color" className="shadow appearance-none border rounded w-full py-2 px-3 bg-gray-700 border-gray-600 text-gray-200 leading-tight focus:outline-none focus:shadow-outline ml-3" placeholder="#b55468" />
                            </div>
                        </div>
                    ) : null}
                    
                    {parentKey !== null && renderField('color_factor', 'Color Factor', 'number')}
                </div>
                <div className="mt-6 flex justify-end space-x-4">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">Cancel</button>
                    <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">Save</button>
                </div>
            </div>
        </div>
    );
};

// --- TREE NODE COMPONENT ---
interface TreeNodeProps {
    node: TreeNodeData;
    isReadOnly?: boolean;
    onAddItem: (parentKey: string) => void;
    onEditItem: (item: TreeNodeData) => void;
    onDeleteItem: (itemKey: string, parentKey: string | null) => void;
    onColorChange: (itemKey: string, newColor: string) => void;
}
const TreeNode: React.FC<TreeNodeProps> = ({ node, isReadOnly = false, onAddItem, onEditItem, onDeleteItem, onColorChange }) => {
    const [isOpen, setIsOpen] = useState(true);
    const hasChildren = node.children && node.children.length > 0;
    
    const handleColorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onColorChange(node.key, e.target.value);
    };

    const getItemType = (item: ContentItem) => {
        if (item.is_menu) return { text: 'Menu', color: 'bg-blue-600' };
        if (item.is_video) return { text: 'Video', color: 'bg-purple-600' };
        if (item.is_audio) return { text: 'Audio', color: 'bg-pink-600' };
        if (item.is_lottie) return { text: 'Lottie', color: 'bg-orange-600' };
        return null;
    };
    
    const itemType = getItemType(node);

    return (
        <div className="ml-6 my-1">
            <div className={`flex items-center group rounded p-2 transition-colors ${isReadOnly ? 'bg-gray-800/50' : 'bg-gray-800 hover:bg-gray-700'}`}>
                <div className="w-5 h-5 mr-2">
                    {node.is_menu && hasChildren && (<button onClick={() => setIsOpen(!isOpen)} className="focus:outline-none"><ChevronRightIcon open={isOpen} /></button>)}
                </div>
                <input 
                    type="color" 
                    value={node.displayColor}
                    onChange={handleColorInputChange}
                    disabled={isReadOnly}
                    className="p-0 h-6 w-6 block bg-transparent border-none cursor-pointer rounded-md appearance-none disabled:cursor-not-allowed"
                    title={isReadOnly ? 'Color is read-only' : 'Click to change color'}
                />
                <span className={`font-semibold text-lg ml-3 ${isReadOnly ? 'text-cyan-600' : 'text-cyan-400'}`}>{node.key}</span>
                {itemType && <span className={`ml-3 text-xs text-white font-bold px-2 py-1 rounded-full ${itemType.color}`}>{itemType.text}</span>}
                <span className="text-gray-500 mx-2">-</span>
                <span className="text-gray-400 truncate">{node.centerLabel?.replace(/\n/g, ' ') || (node as any).label?.replace(/\n/g, ' ')}</span>
                
                {!isReadOnly && (
                    <div className="ml-auto flex items-center space-x-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        {node.is_menu && (<button onClick={() => onAddItem(node.key)} className="p-2 rounded-full bg-green-500 text-white hover:bg-green-600" title="Add child"><PlusIcon size={4} /></button>)}
                        <button onClick={() => onEditItem(node)} className="p-2 rounded-full bg-yellow-500 text-white hover:bg-yellow-600" title="Edit item"><PencilIcon size={4} /></button>
                        <button onClick={() => onDeleteItem(node.key, node.parentKey)} className="p-2 rounded-full bg-red-500 text-white hover:bg-red-600" title="Delete item"><TrashIcon size={4} /></button>
                    </div>
                )}
            </div>
            {isOpen && hasChildren && (
                <div className="border-l-2 border-gray-700 pl-4">
                    {node.children.map(child => (<TreeNode key={child.key} node={child} isReadOnly={isReadOnly} onAddItem={onAddItem} onEditItem={onEditItem} onDeleteItem={onDeleteItem} onColorChange={onColorChange} />))}
                </div>
            )}
        </div>
    );
};


// --- UPLOAD SCREEN ---
const UploadScreen = ({ onFilesLoaded }: { onFilesLoaded: (content: ContentItem[], flow: any) => void }) => {
    const [contentFile, setContentFile] = useState<File | null>(null);
    const [flowFile, setFlowFile] = useState<File | null>(null);
    const [error, setError] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'content' | 'flow') => {
        const file = e.target.files?.[0];
        if (file) {
            if (type === 'content') setContentFile(file);
            else setFlowFile(file);
        }
    };

    const handleLoadData = () => {
        if (!contentFile || !flowFile) {
            setError('Please select both content.json and flow.json files.');
            return;
        }
        setError('');
        const readerContent = new FileReader();
        readerContent.onload = (e) => {
            try {
                const content = JSON.parse(e.target?.result as string);
                const readerFlow = new FileReader();
                readerFlow.onload = (e2) => {
                    try {
                        const flow = JSON.parse(e2.target?.result as string);
                        onFilesLoaded(content, flow);
                    } catch (err) {
                        setError('Failed to parse flow.json. Please ensure it is valid JSON.');
                    }
                };
                readerFlow.readAsText(flowFile);
            } catch (err) {
                setError('Failed to parse content.json. Please ensure it is valid JSON.');
            }
        };
        readerContent.readAsText(contentFile);
    };

    const FileInput = ({ label, file, onChange }: { label: string, file: File | null, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
        <div>
            <label className="block text-gray-400 text-sm font-bold mb-2">{label}</label>
            <label htmlFor={label} className="w-full flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:bg-gray-700 transition">
                <UploadIcon />
                <span className="ml-3 text-gray-300">{file ? file.name : 'Click to select a file'}</span>
            </label>
            <input id={label} type="file" accept=".json" className="hidden" onChange={onChange} />
        </div>
    );

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
            <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-md">
                <h1 className="text-3xl font-bold text-center text-cyan-400 mb-6">Load JSON Data</h1>
                <div className="space-y-6">
                    <FileInput label="content.json" file={contentFile} onChange={(e) => handleFileChange(e, 'content')} />
                    <FileInput label="flow.json" file={flowFile} onChange={(e) => handleFileChange(e, 'flow')} />
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <button onClick={handleLoadData} disabled={!contentFile || !flowFile} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition">Load Editor</button>
                </div>
            </div>
        </div>
    );
};


// --- UI PREVIEW COMPONENT ---
interface UIPreviewProps {
    previewStack: string[];
    setPreviewStack: React.Dispatch<React.SetStateAction<string[]>>;
    fullContentMap: Map<string, ContentItem>;
    mainMenuFlow: any;
}

const UIPreview: React.FC<UIPreviewProps> = ({ previewStack, setPreviewStack, fullContentMap, mainMenuFlow }) => {
    const currentKey = previewStack[previewStack.length - 1];
    const menuData = fullContentMap.get(currentKey);

    const getFlowForCurrentKey = () => {
        let currentFlow = { main_menu: mainMenuFlow };
        for (const key of previewStack) {
            if (currentFlow && typeof currentFlow === 'object' && key in currentFlow) {
                currentFlow = (currentFlow as any)[key];
            } else {
                return null;
            }
        }
        return currentFlow;
    };
    
    const menuFlow = getFlowForCurrentKey();

    if (!menuData || !menuData.is_menu || !menuData.options) {
        return <div className="text-white">Preview not available for this item.</div>;
    }

    const optionsToRenderKeys = menuFlow ? (Array.isArray(menuFlow) ? menuFlow : Object.keys(menuFlow)) : [];
    const optionsWithDetails = optionsToRenderKeys
        .map(key => menuData.options?.find(opt => opt.key === key))
        .filter(Boolean) as (Option & { itemDetails?: ContentItem })[];
    
    optionsWithDetails.forEach(opt => opt.itemDetails = fullContentMap.get(opt.key));

    const size = 384; // 96 * 4
    const center = size / 2;
    const radius = size / 2 - 10;
    const innerRadius = radius * 0.55;

    const PolarToCartesian = (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
        const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
        return {
            x: centerX + (r * Math.cos(angleInRadians)),
            y: centerY + (r * Math.sin(angleInRadians))
        };
    };

    const describePizzaSlice = (x: number, y: number, r: number, startAngle: number, endAngle: number) => {
        const start = PolarToCartesian(x, y, r, startAngle);
        const end = PolarToCartesian(x, y, r, endAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
        return [
            'M', x, y,
            'L', start.x, start.y,
            'A', r, r, 0, largeArcFlag, 1, end.x, end.y,
            'Z'
        ].join(' ');
    };
    
    const handleSliceClick = (option: Option & { itemDetails?: ContentItem }) => {
        if (option.itemDetails?.is_menu) {
            setPreviewStack(prev => [...prev, option.key]);
        }
    };
    
    const handleBack = () => {
        if (previewStack.length > 1) {
            setPreviewStack(prev => prev.slice(0, -1));
        }
    };

    return (
        <div className="flex flex-col items-center">
            {previewStack.length > 1 && (
                <button onClick={handleBack} className="mb-4 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded inline-flex items-center gap-2">
                    <ArrowLeftIcon /> Back
                </button>
            )}
            <div className="relative" style={{ width: size, height: size }}>
                 <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <defs>
                        <mask id="hole">
                            <rect width="100%" height="100%" fill="white"/>
                            <circle cx={center} cy={center} r={innerRadius} fill="black"/>
                        </mask>
                    </defs>
                    <g mask="url(#hole)">
                        {optionsWithDetails.length > 0 ? (
                            (() => {
                                const sliceAngle = 360 / optionsWithDetails.length;
                                return optionsWithDetails.map((opt, i) => {
                                    const startAngle = i * sliceAngle;
                                    const endAngle = (i + 1) * sliceAngle;
                                    const pathData = describePizzaSlice(center, center, radius, startAngle, endAngle);
                                    
                                    return (
                                        <path
                                            key={opt.key}
                                            d={pathData}
                                            fill={opt.color || '#cccccc'}
                                            stroke="#0f172a"
                                            strokeWidth="3"
                                            onClick={() => handleSliceClick(opt)}
                                            className={opt.itemDetails?.is_menu ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}
                                        />
                                    );
                                });
                            })()
                        ) : (
                            <circle cx={center} cy={center} r={radius} fill="#4a5568" />
                        )}
                    </g>
                    {/* Labels need to be drawn on top, outside the mask */}
                    {optionsWithDetails.length > 0 && (() => {
                        const sliceAngle = 360 / optionsWithDetails.length;
                        return optionsWithDetails.map((opt, i) => {
                             const startAngle = i * sliceAngle;
                             const midAngle = startAngle + sliceAngle / 2;
                             const labelRadius = innerRadius + (radius - innerRadius) / 2;
                             const labelPos = PolarToCartesian(center, center, labelRadius, midAngle);
                             const labelParts = (opt.label || '').split('\n').filter(Boolean);

                             return (
                                <text
                                    key={opt.key}
                                    x={labelPos.x}
                                    y={labelPos.y}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fill="white"
                                    className="font-bold text-sm pointer-events-none"
                                    style={{ fontSize: '14px' }}
                                >
                                    {labelParts.map((part, index) => (
                                        <tspan key={index} x={labelPos.x} dy={index === 0 ? 0 : '1.2em'}>{part}</tspan>
                                    ))}
                                </text>
                             )
                        })
                    })()}
                 </svg>
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ margin: `${(size - (innerRadius * 2)) / 2}px` }}>
                    <div className="bg-slate-900 rounded-full w-full h-full flex items-center justify-center">
                        <h2 className="text-white text-xl font-bold text-center whitespace-pre-wrap">
                            {menuData.centerLabel}
                        </h2>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- TREE CONTAINER ---
const TreeContainer = ({ title, treeData, isReadOnly, onAddItem, onEditItem, onDeleteItem, onColorChange }: any) => {
    const [isOpen, setIsOpen] = useState(true);
    return (
        <div className="bg-gray-800/50 rounded-lg p-2 mb-4">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full text-left p-2 bg-gray-900/50 rounded-md hover:bg-gray-700/50 flex items-center justify-between">
                <h2 className="text-xl font-semibold">{title}</h2>
                <ChevronRightIcon open={isOpen} />
            </button>
            {isOpen && (
                <div className="pt-2">
                    {treeData.map((node: TreeNodeData) => (
                        <TreeNode key={node.key} node={node} isReadOnly={isReadOnly} onAddItem={onAddItem} onEditItem={onEditItem} onDeleteItem={onDeleteItem} onColorChange={onColorChange} />
                    ))}
                </div>
            )}
        </div>
    );
};


// --- MAIN APP COMPONENT ---
export default function App() {
    const [contentData, setContentData] = useState<ContentItem[] | null>(null);
    const [flowData, setFlowData] = useState<any | null>(null);
    
    const [mainMenuTree, setMainMenuTree] = useState<TreeNodeData[]>([]);
    const [settingsTree, setSettingsTree] = useState<TreeNodeData[]>([]);
    
    const [preservedSettings, setPreservedSettings] = useState<{ content: ContentItem[], flow: any } | null>(null);

    const [editState, setEditState] = useState<EditState>(null);
    const [showJsonPreview, setShowJsonPreview] = useState(false);
    const [showUIPreview, setShowUIPreview] = useState(true);
    
    const [previewStack, setPreviewStack] = useState<string[]>(['main_menu']);

    const fullContentMap = useMemo(() => {
        const allContent = [...(contentData || []), ...(preservedSettings?.content || [])];
        return new Map(allContent.map(item => [item.key, item]));
    }, [contentData, preservedSettings]);
    
    const allKeys = useMemo(() => new Set(fullContentMap.keys()), [fullContentMap]);

    useEffect(() => {
        if (contentData && flowData) {
            const mainMenuMap = new Map(contentData.map(item => [item.key, item]));
            const tree = buildTreeFromFlow({ main_menu: flowData }, mainMenuMap);
            setMainMenuTree(tree);
        }
        if (preservedSettings) {
            const settingsMap = new Map(preservedSettings.content.map(item => [item.key, item]));
            const tree = buildTreeFromFlow(preservedSettings.flow, settingsMap);
            setSettingsTree(tree);
        }
    }, [contentData, flowData, preservedSettings]);

    const handleFilesLoaded = (content: ContentItem[], flow: any) => {
        const mainMenuFlow = flow?.settings_menu?.main_menu || {};
        const settingsMenuFlow = { ...flow };
        if(settingsMenuFlow.settings_menu) {
            delete settingsMenuFlow.settings_menu.main_menu;
        }

        const settingsKeys = getDescendantKeys(settingsMenuFlow, 'settings_menu');
        
        const mainMenuContent = content.filter(item => !settingsKeys.has(item.key));
        const settingsContent = content.filter(item => settingsKeys.has(item.key));

        setContentData(mainMenuContent);
        setFlowData(mainMenuFlow);
        setPreservedSettings({ content: settingsContent, flow: settingsMenuFlow });
    };

    const handleAddItem = (parentKey: string) => {
        setEditState({ mode: 'add', item: { key: '' }, parentKey });
    };

    const handleEditItem = (item: TreeNodeData) => {
        setEditState({ mode: 'edit', item: { ...item, color: item.displayColor }, parentKey: item.parentKey });
    };
    
    const handleDeleteItem = useCallback((itemKey: string, parentKey: string | null) => {
        if (!window.confirm(`Are you sure you want to delete "${itemKey}" and all its children?`)) return;

        const keysToDelete = new Set<string>([itemKey]);
        const queue: string[] = [itemKey];
        
        while(queue.length > 0) {
            const currentKey = queue.shift()!;
            const currentItem = fullContentMap.get(currentKey);
            if (currentItem?.is_menu && currentItem.options) {
                currentItem.options.forEach((opt: any) => {
                    keysToDelete.add(opt.key);
                    queue.push(opt.key);
                });
            }
        }

        setContentData(prev => prev ? prev.filter(item => !keysToDelete.has(item.key)) : null);
        
        const deleteFromFlow = (flow: any) => {
             if (parentKey) {
                return deepModifyFlow(flow, parentKey, children => {
                    if (Array.isArray(children)) { return children.filter(key => key !== itemKey); }
                    if (typeof children === 'object') { const newChildren = { ...children }; delete newChildren[itemKey]; return newChildren; }
                    return children;
                });
            } else {
                 const newFlow = {...flow}; delete newFlow[itemKey]; return newFlow; 
            }
        }
        setFlowData(prevFlow => deleteFromFlow(prevFlow));

    }, [fullContentMap]);

    const handleSaveItem = (newItem: ContentItem, parentKey: string | null) => {
        if (editState?.mode === 'add') {
            setContentData(prev => (prev ? [...prev, newItem] : [newItem]));
            if (parentKey) {
                 const newOption: Option = { key: newItem.key, label: newItem.label || '' };
                 if (newItem.color) newOption.color = newItem.color;
                 if (newItem.color_factor) newOption.color_factor = newItem.color_factor;

                 setContentData(prev => prev!.map(p => {
                     if (p.key === parentKey && p.is_menu) {
                         return { ...p, options: [...(p.options || []), newOption]};
                     }
                     return p;
                 }));
                 setFlowData(prevFlow => deepModifyFlow(prevFlow, parentKey, children => {
                    const newKey = newItem.key;
                    if (newItem.is_menu) return {...children, [newKey]: {}};
                    return [...(Array.isArray(children) ? children : []), newKey];
                }));
            } else { 
                setFlowData(prevFlow => ({ ...prevFlow, [newItem.key]: newItem.is_menu ? {} : [] }));
            }
        } else { // edit mode
            const oldKey = editState!.item.key;
            const newKey = newItem.key;
            
            let newContentData = contentData!.map(i => i.key === oldKey ? newItem : i);
            
            if (parentKey) {
                newContentData = newContentData.map(p => {
                    if (p.key === parentKey && p.is_menu && p.options) {
                        return { ...p, options: p.options.map(opt => opt.key === oldKey ? { ...opt, key: newKey, label: newItem.label || '', color: newItem.color, color_factor: newItem.color_factor } : opt) };
                    }
                    return p;
                });
            }
            setContentData(newContentData);

            if (oldKey !== newKey) {
                setFlowData(prevFlow => deepReplaceKey(prevFlow, oldKey, newKey));
            }
        }
    };
    
    const handleColorChange = (itemKey: string, newColor: string) => {
        setContentData(prev => prev!.map(item => {
            if (item.key === itemKey) {
                return { ...item, color: newColor };
            }
            if (item.is_menu && item.options) {
                const newOptions = item.options.map(opt => opt.key === itemKey ? {...opt, color: newColor} : opt);
                return {...item, options: newOptions};
            }
            return item;
        }));
    };
    
    const downloadJson = (data: any, filename: string) => {
        if (!data) return;
        const jsonStr = JSON.stringify(data, null, 4);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleExport = () => {
        if (!contentData || !flowData || !preservedSettings) return;
        
        const processedContent = contentData.map(item => {
            const newItem = { ...item };
            const basePath = '/home/pi/qtremote/';
            if (newItem.is_audio && newItem.audioSource && !newItem.audioSource.startsWith(basePath)) newItem.audioSource = `${basePath}music/${newItem.audioSource}`;
            if (newItem.is_video && newItem.videoSource && !newItem.videoSource.startsWith(basePath)) newItem.videoSource = `${basePath}video/${newItem.videoSource}`;
            if (newItem.is_lottie && newItem.lottieSource && !newItem.lottieSource.startsWith(basePath)) newItem.lottieSource = `${basePath}lottie/${newItem.lottieSource}`;
            return newItem;
        });

        const finalContent = [...processedContent, ...preservedSettings.content];
        
        const finalFlow = JSON.parse(JSON.stringify(preservedSettings.flow));
        if (finalFlow.settings_menu) {
            finalFlow.settings_menu.main_menu = flowData;
        } else {
             finalFlow.main_menu = flowData;
        }

        downloadJson(finalContent, "menu_data.json");
        downloadJson(finalFlow, "menu_flow.json");
    };

    if (!contentData || !flowData) {
        return <UploadScreen onFilesLoaded={handleFilesLoaded} />;
    }

    return (
        <div className="min-h-screen bg-slate-900 text-gray-100 flex flex-col">
            <header className="bg-gray-800 shadow-md p-4 flex justify-between items-center gap-4 flex-shrink-0">
                <h1 className="text-3xl font-bold text-cyan-400">Menu Editor</h1>
                <div className="flex items-center gap-4">
                     <label className="flex items-center cursor-pointer">
                        <input type="checkbox" checked={showJsonPreview} onChange={() => setShowJsonPreview(p => !p)} className="h-5 w-5 rounded bg-gray-600 border-gray-500 focus:ring-blue-500" />
                        <span className="ml-2 text-gray-300">Preview JSON</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                        <input type="checkbox" checked={showUIPreview} onChange={() => setShowUIPreview(p => !p)} className="h-5 w-5 rounded bg-gray-600 border-gray-500 focus:ring-blue-500" />
                        <span className="ml-2 text-gray-300">UI Preview</span>
                    </label>
                    <button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded inline-flex items-center gap-2">
                        <DownloadIcon /> Export Files
                    </button>
                </div>
            </header>
            <main className="flex-grow flex p-4 gap-4 overflow-hidden">
                {showJsonPreview && (
                    <div className="w-1/4 flex flex-col gap-4">
                        <JsonDisplay title="Content JSON (Final)" data={[...(contentData || []), ...(preservedSettings?.content || [])]} />
                        <JsonDisplay title="Flow JSON (Final)" data={preservedSettings && flowData ? { ...preservedSettings.flow, settings_menu: { ...(preservedSettings.flow.settings_menu), main_menu: flowData }} : {}} />
                    </div>
                )}
                <div className="flex-1 bg-gray-800 rounded-lg p-4 flex flex-col">
                     <div className="flex-grow overflow-y-auto pr-2">
                        {mainMenuTree.length > 0 && <TreeContainer title="Main Menu (Editable)" treeData={mainMenuTree} isReadOnly={false} onAddItem={handleAddItem} onEditItem={handleEditItem} onDeleteItem={handleDeleteItem} onColorChange={handleColorChange} />}
                        {settingsTree.length > 0 && <TreeContainer title="Settings Menu (Read-Only)" treeData={settingsTree} isReadOnly={true} onAddItem={()=>{}} onEditItem={()=>{}} onDeleteItem={()=>{}} onColorChange={()=>{}} />}
                    </div>
                </div>
                {showUIPreview && (
                    <div className="w-1/3 bg-gray-800 rounded-lg p-4 flex flex-col items-center justify-start overflow-y-auto">
                         <h2 className="text-xl font-semibold mb-4 text-center">UI Preview</h2>
                         <UIPreview previewStack={previewStack} setPreviewStack={setPreviewStack} fullContentMap={fullContentMap} mainMenuFlow={flowData} />
                    </div>
                )}
            </main>
             {editState && <ItemModal editState={editState} onClose={() => setEditState(null)} onSave={handleSaveItem} allKeys={allKeys} />}
        </div>
    );
}

const JsonDisplay = ({ title, data }: { title: string, data: any }) => {
    const jsonString = useMemo(() => JSON.stringify(data, null, 2), [data]);
    
    return (
        <div className="bg-gray-800 rounded-lg p-4 flex flex-col h-1/2">
            <h3 className="text-lg font-semibold mb-2">{title}</h3>
            <textarea
                readOnly
                value={jsonString}
                className="w-full flex-grow bg-gray-900 text-gray-300 font-mono text-sm p-2 border border-gray-700 rounded resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
        </div>
    );
};
