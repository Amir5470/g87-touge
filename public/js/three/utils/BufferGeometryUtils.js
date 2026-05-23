import {
    BufferAttribute,
    BufferGeometry,
    Float32BufferAttribute,
    InstancedBufferAttribute,
    InterleavedBuffer,
    InterleavedBufferAttribute,
    TriangleFanDrawMode,
    TriangleStripDrawMode,
    TrianglesDrawMode,
    Vector3,
} from '../three.module.min.js';

function computeMikkTSpaceTangents( geometry, MikkTSpace, negateSign = true ) {

    if ( ! MikkTSpace || ! MikkTSpace.isReady ) {

        throw new Error( 'BufferGeometryUtils: Initialized MikkTSpace library required.' );

    }

    if ( ! geometry.hasAttribute( 'position' ) || ! geometry.hasAttribute( 'normal' ) || ! geometry.hasAttribute( 'uv' ) ) {

        throw new Error( 'BufferGeometryUtils: Tangents require "position", "normal", and "uv" attributes.' );

    }

    function getAttributeArray( attribute ) {

        if ( attribute.normalized || attribute.isInterleavedBufferAttribute ) {

            const dstArray = new Float32Array( attribute.count * attribute.itemSize );

            for ( let i = 0, j = 0; i < attribute.count; i ++ ) {

                dstArray[ j ++ ] = attribute.getX( i );
                dstArray[ j ++ ] = attribute.getY( i );

                if ( attribute.itemSize > 2 ) {

                    dstArray[ j ++ ] = attribute.getZ( i );

                }

            }

            return dstArray;

        }

        if ( attribute.array instanceof Float32Array ) {

            return attribute.array;

        }

        return new Float32Array( attribute.array );

    }

    const _geometry = geometry.index ? geometry.toNonIndexed() : geometry;

    const tangents = MikkTSpace.generateTangents(

        getAttributeArray( _geometry.attributes.position ),
        getAttributeArray( _geometry.attributes.normal ),
        getAttributeArray( _geometry.attributes.uv )

    );

    if ( negateSign ) {

        for ( let i = 3; i < tangents.length; i += 4 ) {

            tangents[ i ] *= - 1;

        }

    }

    _geometry.setAttribute( 'tangent', new BufferAttribute( tangents, 4 ) );

    if ( geometry !== _geometry ) {

        geometry.copy( _geometry );

    }

    return geometry;

}

function mergeGeometries( geometries, useGroups = false ) {

    const isIndexed = geometries[ 0 ].index !== null;

    const attributesUsed = new Set( Object.keys( geometries[ 0 ].attributes ) );
    const morphAttributesUsed = new Set( Object.keys( geometries[ 0 ].morphAttributes ) );

    const attributes = {};
    const morphAttributes = {};

    const morphTargetsRelative = geometries[ 0 ].morphTargetsRelative;

    const mergedGeometry = new BufferGeometry();

    let offset = 0;

    for ( let i = 0; i < geometries.length; ++ i ) {

        const geometry = geometries[ i ];
        let attributesCount = 0;

        if ( isIndexed !== ( geometry.index !== null ) ) {

            console.error( 'THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index ' + i + '. All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them.' );
            return null;

        }

        for ( const name in geometry.attributes ) {

            if ( ! attributesUsed.has( name ) ) {

                console.error( 'THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index ' + i + '. All geometries must have compatible attributes; make sure "' + name + '" attribute exists among all geometries, or in none of them.' );
                return null;

            }

            if ( attributes[ name ] === undefined ) attributes[ name ] = [];

            attributes[ name ].push( geometry.attributes[ name ] );

            attributesCount ++;

        }

        if ( attributesCount !== attributesUsed.size ) {

            console.error( 'THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index ' + i + '. Make sure all geometries have the same number of attributes.' );
            return null;

        }

        if ( morphTargetsRelative !== geometry.morphTargetsRelative ) {

            console.error( 'THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index ' + i + '. .morphTargetsRelative must be consistent throughout all geometries.' );
            return null;

        }

        for ( const name in geometry.morphAttributes ) {

            if ( ! morphAttributesUsed.has( name ) ) {

                console.error( 'THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index ' + i + '.  .morphAttributes must be consistent throughout all geometries.' );
                return null;

            }

            if ( morphAttributes[ name ] === undefined ) morphAttributes[ name ] = [];

            morphAttributes[ name ].push( geometry.morphAttributes[ name ] );

        }

        if ( useGroups ) {

            let count;

            if ( isIndexed ) {

                count = geometry.index.count;

            } else if ( geometry.attributes.position !== undefined ) {

                count = geometry.attributes.position.count;

            } else {

                console.error( 'THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index ' + i + '. The geometry must have either an index or a position attribute' );
                return null;

            }

            mergedGeometry.addGroup( offset, count, i );

            offset += count;

        }

    }

    if ( isIndexed ) {

        let indexOffset = 0;
        const mergedIndex = [];

        for ( let i = 0; i < geometries.length; ++ i ) {

            const index = geometries[ i ].index;

            for ( let j = 0; j < index.count; ++ j ) {

                mergedIndex.push( index.getX( j ) + indexOffset );

            }

            indexOffset += geometries[ i ].attributes.position.count;

        }

        mergedGeometry.setIndex( mergedIndex );

    }

    for ( const name in attributes ) {

        const mergedAttribute = mergeAttributes( attributes[ name ] );

        if ( ! mergedAttribute ) {

            console.error( 'THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the ' + name + ' attribute.' );
            return null;

        }

        mergedGeometry.setAttribute( name, mergedAttribute );

    }

    for ( const name in morphAttributes ) {

        const numMorphTargets = morphAttributes[ name ][ 0 ].length;

        if ( numMorphTargets === 0 ) break;

        mergedGeometry.morphAttributes = mergedGeometry.morphAttributes || {};
        mergedGeometry.morphAttributes[ name ] = [];

        for ( let i = 0; i < numMorphTargets; ++ i ) {

            const morphAttributesToMerge = [];

            for ( let j = 0; j < morphAttributes[ name ].length; ++ j ) {

                morphAttributesToMerge.push( morphAttributes[ name ][ j ][ i ] );

            }

            const mergedMorphAttribute = mergeAttributes( morphAttributesToMerge );

            if ( ! mergedMorphAttribute ) {

                console.error( 'THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the ' + name + ' morphAttribute.' );
                return null;

            }

            mergedGeometry.morphAttributes[ name ].push( mergedMorphAttribute );

        }

    }

    return mergedGeometry;

}

function mergeAttributes( attributes ) {

    let TypedArray;
    let itemSize;
    let normalized;
    let gpuType = - 1;
    let arrayLength = 0;

    for ( let i = 0; i < attributes.length; ++ i ) {

        const attribute = attributes[ i ];

        if ( TypedArray === undefined ) TypedArray = attribute.array.constructor;
        if ( TypedArray !== attribute.array.constructor ) {

            console.error( 'THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes.' );
            return null;

        }

        if ( itemSize === undefined ) itemSize = attribute.itemSize;
        if ( itemSize !== attribute.itemSize ) {

            console.error( 'THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes.' );
            return null;

        }

        if ( normalized === undefined ) normalized = attribute.normalized;
        if ( normalized !== attribute.normalized ) {

            console.error( 'THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes.' );
            return null;

        }

        if ( gpuType === - 1 ) gpuType = attribute.gpuType;
        if ( gpuType !== attribute.gpuType ) {

            console.error( 'THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes.' );
            return null;

        }

        arrayLength += attribute.count * itemSize;

    }

    const array = new TypedArray( arrayLength );
    const result = new BufferAttribute( array, itemSize, normalized );
    let offset = 0;

    for ( let i = 0; i < attributes.length; ++ i ) {

        const attribute = attributes[ i ];
        if ( attribute.isInterleavedBufferAttribute ) {

            const tupleOffset = offset / itemSize;
            for ( let j = 0, l = attribute.count; j < l; j ++ ) {

                for ( let c = 0; c < itemSize; c ++ ) {

                    const value = attribute.getComponent( j, c );
                    result.setComponent( j + tupleOffset, c, value );

                }

            }

        } else {

            array.set( attribute.array, offset );

        }

        offset += attribute.count * itemSize;

    }

    if ( gpuType !== undefined ) {

        result.gpuType = gpuType;

    }

    return result;

}

function deepCloneAttribute( attribute ) {

    if ( attribute.isInstancedInterleavedBufferAttribute || attribute.isInterleavedBufferAttribute ) {

        return deinterleaveAttribute( attribute );

    }

    if ( attribute.isInstancedBufferAttribute ) {

        return new InstancedBufferAttribute().copy( attribute );

    }

    return new BufferAttribute().copy( attribute );

}

function interleaveAttributes( attributes ) {

    let TypedArray;
    let arrayLength = 0;
    let stride = 0;

    for ( let i = 0, l = attributes.length; i < l; ++ i ) {

        const attribute = attributes[ i ];

        if ( TypedArray === undefined ) TypedArray = attribute.array.constructor;
        if ( TypedArray !== attribute.array.constructor ) {

            console.error( 'AttributeBuffers of different types cannot be interleaved' );
            return null;

        }

        arrayLength += attribute.array.length;
        stride += attribute.itemSize;

    }

    const interleavedBuffer = new InterleavedBuffer( new TypedArray( arrayLength ), stride );
    let offset = 0;
    const res = [];
    const getters = [ 'getX', 'getY', 'getZ', 'getW' ];
    const setters = [ 'setX', 'setY', 'setZ', 'setW' ];

    for ( let j = 0, l = attributes.length; j < l; j ++ ) {

        const attribute = attributes[ j ];
        const itemSize = attribute.itemSize;
        const count = attribute.count;
        const iba = new InterleavedBufferAttribute( interleavedBuffer, itemSize, offset, attribute.normalized );
        res.push( iba );

        offset += itemSize;

        for ( let c = 0; c < count; c ++ ) {

            for ( let k = 0; k < itemSize; k ++ ) {

                iba[ setters[ k ] ]( c, attribute[ getters[ k ] ]( c ) );

            }

        }

    }

    return res;

}

function deinterleaveAttribute( attribute ) {

    const cons = attribute.data.array.constructor;
    const count = attribute.count;
    const itemSize = attribute.itemSize;
    const normalized = attribute.normalized;

    const array = new cons( count * itemSize );
    let newAttribute;
    if ( attribute.isInstancedInterleavedBufferAttribute ) {

        newAttribute = new InstancedBufferAttribute( array, itemSize, normalized, attribute.meshPerAttribute );

    } else {

        newAttribute = new BufferAttribute( array, itemSize, normalized );

    }

    for ( let i = 0; i < count; i ++ ) {

        newAttribute.setX( i, attribute.getX( i ) );

        if ( itemSize >= 2 ) {

            newAttribute.setY( i, attribute.getY( i ) );

        }

        if ( itemSize >= 3 ) {

            newAttribute.setZ( i, attribute.getZ( i ) );

        }

        if ( itemSize >= 4 ) {

            newAttribute.setW( i, attribute.getW( i ) );

        }

    }

    return newAttribute;

}

function deinterleaveGeometry( geometry ) {

    const attributes = geometry.attributes;
    const morphTargets = geometry.morphTargets;
    const attrMap = new Map();

    for ( const key in attributes ) {

        const attr = attributes[ key ];
        if ( attr.isInterleavedBufferAttribute ) {

            if ( ! attrMap.has( attr ) ) {

                attrMap.set( attr, deinterleaveAttribute( attr ) );

            }

            attributes[ key ] = attrMap.get( attr );

        }

    }

    for ( const key in morphTargets ) {

        const attr = morphTargets[ key ];
        if ( attr.isInterleavedBufferAttribute ) {

            if ( ! attrMap.has( attr ) ) {

                attrMap.set( attr, deinterleaveAttribute( attr ) );

            }

            morphTargets[ key ] = attrMap.get( attr );

        }

    }

}

function estimateBytesUsed( geometry ) {

    let mem = 0;
    for ( const name in geometry.attributes ) {

        const attr = geometry.getAttribute( name );
        mem += attr.count * attr.itemSize * attr.array.BYTES_PER_ELEMENT;

    }

    const indices = geometry.getIndex();
    mem += indices ? indices.count * indices.itemSize * indices.array.BYTES_PER_ELEMENT : 0;
    return mem;

}

function mergeVertices( geometry, tolerance = 1e-4 ) {

    tolerance = Math.max( tolerance, Number.EPSILON );

    const hashToIndex = {};
    const indices = geometry.getIndex();
    const positions = geometry.getAttribute( 'position' );
    const vertexCount = indices ? indices.count : positions.count;

    let nextIndex = 0;

    const attributeNames = Object.keys( geometry.attributes );
    const tmpAttributes = {};
    const tmpMorphAttributes = {};
    const newIndices = [];
    const getters = [ 'getX', 'getY', 'getZ', 'getW' ];
    const setters = [ 'setX', 'setY', 'setZ', 'setW' ];

    for ( let i = 0, l = attributeNames.length; i < l; i ++ ) {

        const name = attributeNames[ i ];
        const attr = geometry.attributes[ name ];

        tmpAttributes[ name ] = new attr.constructor(
            new attr.array.constructor( attr.count * attr.itemSize ),
            attr.itemSize,
            attr.normalized
        );

        const morphAttributes = geometry.morphAttributes[ name ];
        if ( morphAttributes ) {

            if ( ! tmpMorphAttributes[ name ] ) tmpMorphAttributes[ name ] = [];
            morphAttributes.forEach( ( morphAttr, i ) => {

                const array = new morphAttr.array.constructor( morphAttr.count * morphAttr.itemSize );
                tmpMorphAttributes[ name ][ i ] = new morphAttr.constructor( array, morphAttr.itemSize, morphAttr.normalized );

            } );

        }

    }

    const halfTolerance = tolerance * 0.5;
    const exponent = Math.log10( 1 / tolerance );
    const hashMultiplier = Math.pow( 10, exponent );
    const hashAdditive = halfTolerance * hashMultiplier;
    for ( let i = 0; i < vertexCount; i ++ ) {

        const index = indices ? indices.getX( i ) : i;

        let hash = '';
        for ( let j = 0, l = attributeNames.length; j < l; j ++ ) {

            const name = attributeNames[ j ];
            const attribute = geometry.getAttribute( name );
            const itemSize = attribute.itemSize;

            for ( let k = 0; k < itemSize; k ++ ) {

                hash += `${ ~ ~ ( attribute[ getters[ k ] ]( index ) * hashMultiplier + hashAdditive ) },`;

            }

        }

        if ( hash in hashToIndex ) {

            newIndices.push( hashToIndex[ hash ] );

        } else {

            for ( let j = 0, l = attributeNames.length; j < l; j ++ ) {

                const name = attributeNames[ j ];
                const attribute = geometry.getAttribute( name );
                const morphAttributes = geometry.morphAttributes[ name ];
                const itemSize = attribute.itemSize;
                const newArray = tmpAttributes[ name ];
                const newMorphArrays = tmpMorphAttributes[ name ];

                for ( let k = 0; k < itemSize; k ++ ) {

                    const getterFunc = getters[ k ];
                    const setterFunc = setters[ k ];
                    newArray[ setterFunc ]( nextIndex, attribute[ getterFunc ]( index ) );

                    if ( morphAttributes ) {

                        for ( let m = 0, ml = morphAttributes.length; m < ml; m ++ ) {

                            newMorphArrays[ m ][ setterFunc ]( nextIndex, morphAttributes[ m ][ getterFunc ]( index ) );

                        }

                    }

                }

            }

            hashToIndex[ hash ] = nextIndex;
            newIndices.push( nextIndex );
            nextIndex ++;

        }

    }

    const result = geometry.clone();
    for ( const name in geometry.attributes ) {

        const tmpAttribute = tmpAttributes[ name ];

        result.setAttribute( name, new tmpAttribute.constructor(
            tmpAttribute.array.slice( 0, nextIndex * tmpAttribute.itemSize ),
            tmpAttribute.itemSize,
            tmpAttribute.normalized,
        ) );

        if ( ! ( name in tmpMorphAttributes ) ) continue;

        for ( let j = 0; j < tmpMorphAttributes[ name ].length; j ++ ) {

            const tmpMorphAttribute = tmpMorphAttributes[ name ][ j ];

            result.morphAttributes[ name ][ j ] = new tmpMorphAttribute.constructor(
                tmpMorphAttribute.array.slice( 0, nextIndex * tmpMorphAttribute.itemSize ),
                tmpMorphAttribute.itemSize,
                tmpMorphAttribute.normalized,
            );

        }

    }

    result.setIndex( newIndices );

    return result;

}

export { computeMikkTSpaceTangents, mergeGeometries, mergeAttributes, deepCloneAttribute, interleaveAttributes, deinterleaveAttribute, deinterleaveGeometry, estimateBytesUsed, mergeVertices };

function toTrianglesDrawMode( geometry, drawMode ) {

    if ( drawMode === TrianglesDrawMode ) return geometry;

    const index = geometry.getIndex();
    const position = geometry.getAttribute( 'position' );

    if ( index === null ) {

        const indices = [];

        for ( let i = 0; i < position.count; i ++ ) indices.push( i );

        geometry.setIndex( indices );

    }

    const array = geometry.getIndex().array;
    const newIndices = [];

    if ( drawMode === TriangleStripDrawMode ) {

        for ( let i = 0; i < array.length - 2; i ++ ) {

            const a = array[ i ];
            const b = array[ i + 1 ];
            const c = array[ i + 2 ];

            if ( i % 2 === 0 ) newIndices.push( a, b, c ); else newIndices.push( b, a, c );

        }

    } else if ( drawMode === TriangleFanDrawMode ) {

        for ( let i = 1; i < array.length - 1; i ++ ) {

            const a = array[ 0 ];
            const b = array[ i ];
            const c = array[ i + 1 ];

            newIndices.push( a, b, c );

        }

    } else {

        console.error( 'BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:', drawMode );
        return geometry;

    }

    const newGeometry = geometry.clone();
    newGeometry.setIndex( newIndices );
    return newGeometry;

}

export { toTrianglesDrawMode };
