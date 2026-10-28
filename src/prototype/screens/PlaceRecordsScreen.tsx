import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { IS_DEMO_BUILD } from '../../demo/config';
import { MediaViewerModal, type ViewerTarget } from '../../demo/MediaViewerModal';
import { DOWNLOAD_NOT_CONNECTED_MESSAGE, requestDownload } from '../../demo/downloadBridge';
import { NoticeModal } from '../../demo/NoticeModal';
import { recordsForVisit, sortRecords, visitIdOf } from '../../demo/records';
import { SafeImage } from '../../demo/SafeImage';
import { requestUpload, UPLOAD_NOT_CONNECTED_MESSAGE } from '../../demo/uploadBridge';
import { AppHeader } from '../components/AppHeader';
import { Avatar } from '../components/Avatar';
import { MediaPickerSheet, type MediaPickerAction } from '../components/MediaPickerSheet';
import { PersonIcon, PhotoGridIcon } from '../components/ViewModeIcons';
import { ScreenFrame } from '../components/ScreenFrame';
import { StagedMediaThumb, type StagedMedia } from '../components/StagedMediaThumb';
import { Toast, useToast } from '../components/Toast';
import { TRIPS, membersFor, type Itinerary, type ItineraryDay, type MediaKind, type PlaceRecordItem, type TripMember } from '../mock/tripData';
import type { Nav } from '../navigation/routes';
import { colors, GUTTER, MIN_TOUCH, radius } from '../styles/tokens';
import { shortDotDateLabel, dayOfWeekLabel } from '../utils/date';

interface Props {
  nav: Nav;
  tripId: string;
  itinerary: Itinerary;
  day: ItineraryDay;
  placeId: string;
}

/** 내가 한 번에 올릴 수 있는 최대 개수. */
const MAX_MY_ITEMS = 10;
/** "내 순간 올리기" 줄의 썸네일 한 칸 크기(정사각형, px). */
const STAGE_TILE_SIZE = 76;
/** 모든 카드에 쓰는 아주 옅은 그림자. */
const CARD_SHADOW = '0px 2px 10px rgba(25, 31, 40, 0.06)';
/** 최대 개수를 넘겨 고르거나, 이미 꽉 찬 채로 추가를 시도했을 때 보여줄 안내. */
const MAX_ITEMS_MESSAGE = `사진과 동영상은 최대 ${MAX_MY_ITEMS}개까지 올릴 수 있어요`;

/** 화면을 처음 열었을 때 보여줄 예시 선택 상태(사진 2장 + 동영상 1개). 실제로는 모두 뺄 수 있다. */
const DEMO_STAGED: StagedMedia[] = [
  { id: 'demo-1', kind: 'photo', imageUrl: 'https://picsum.photos/seed/reelspot-stage-1/300/300' },
  { id: 'demo-2', kind: 'photo', imageUrl: 'https://picsum.photos/seed/reelspot-stage-2/300/300' },
  { id: 'demo-3', kind: 'video', imageUrl: 'https://picsum.photos/seed/reelspot-stage-video/300/300', durationLabel: '0:12' },
];

/** 같은 파일을 두 번 고르는 걸 걸러내기 위한 식별 키. */
const mediaKey = (asset: ImagePicker.ImagePickerAsset) => asset.assetId ?? `${asset.fileName ?? asset.uri}:${asset.fileSize ?? ''}`;

const formatDuration = (ms: number) => {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

/** 사람별 보기에서 사진 사이 간격(px). */
const GRID_GAP = 4;
/** 사람별 보기 묶음에서 처음 보여 주는 최대 개수(나머지는 +N 으로 접는다). */
const GROUP_PREVIEW = 4;

type ViewMode = 'photo' | 'person';

/** 사람별 보기: 한 스팟원이 올린 모든 사진·동영상을 한 묶음으로 본다. */
interface PersonGroup {
  member: TripMember;
  cards: FlatMediaCard[];
  /** 묶음에서 가장 앞에 나오는 게시물 시각(최신순이면 가장 최근, 오래된순이면 가장 오래된 것) */
  firstTime: string;
}

/** 한 장의 사진·동영상 카드로 펼치기 위한 평평한 항목. 원래 게시물(작성자·시각)과의 연결은 그대로 둔다. */
interface FlatMediaCard {
  item: PlaceRecordItem;
  member: TripMember;
  /** 게시물(업로드 묶음) 시각. 항목별 개별 시각은 데이터에 없어, 같은 게시물의 카드는 모두 이 시각을 쓴다. */
  postTime: string;
}

/**
 * 4. 장소별 사진: 여러 장이 담긴 기존 게시물도 사진 한 장당 카드 하나로 펼쳐서 보여준다.
 * 업로드는 기존 기능(보관함 선택·촬영·중복 거르기·최대 개수)을 그대로 쓰되, 버튼을 누를 때만 연다.
 */
export function PlaceRecordsScreen({ nav, tripId, itinerary, day, placeId }: Props) {
  const toast = useToast();
  // 카드 사진은 가로폭에 맞춘 4:3 으로 높이를 직접 정한다(레이아웃에 따라 비율이 틀어져 사진이 잘려 보이는 문제 방지).
  const { width: windowWidth } = useWindowDimensions();
  const cardImageHeight = Math.round(((Math.min(windowWidth, 430) - GUTTER * 2) * 3) / 4);
  const trip = TRIPS.find((t) => t.id === tripId) ?? TRIPS[0];
  const place = day.places.find((p) => p.id === placeId);
  const members = membersFor(trip);
  // 방문(일정·날짜·장소) 단위로 기록을 찾는다. 같은 장소를 다른 날짜에 담아도 기록이 섞이지 않는다.
  const records = recordsForVisit(itinerary.id, day.id, place ?? { id: placeId });

  /** 최신순(true) / 오래된순(false) */
  const [newestFirst, setNewestFirst] = useState(true);

  const cards: FlatMediaCard[] = sortRecords(records, newestFirst).flatMap((record) => {
    const member = members.find((m) => m.id === record.memberId);
    if (!member) return [];
    return record.items.map((item) => ({ item, member, postTime: record.time }));
  });
  const [viewMode, setViewMode] = useState<ViewMode>('photo');
  /** 사람별 보기에서 "+N"을 눌러 모두 펼친 스팟원 id */
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const groups: PersonGroup[] = [];
  for (const card of cards) {
    let group = groups.find((g) => g.member.id === card.member.id);
    if (!group) {
      group = { member: card.member, cards: [], firstTime: card.postTime };
      groups.push(group);
    }
    group.cards.push(card);
  }
  const gridWidth = Math.min(windowWidth, 430) - GUTTER * 2;
  const hasVideo = cards.some((c) => c.item.kind === 'video');
  const listTitle = hasVideo ? '함께 남긴 순간' : '함께 남긴 사진';

  // 데모에서는 미리 담긴 가짜 선택 없이 빈 상태로 시작한다(고른 것만 보여준다).
  const [staged, setStaged] = useState<StagedMedia[]>(IS_DEMO_BUILD ? [] : DEMO_STAGED);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [viewerTarget, setViewerTarget] = useState<ViewerTarget | null>(null);
  /** 업로드 안내창(팀원 기능 연결 전/실패 시) */
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const appendAssets = (assets: ImagePicker.ImagePickerAsset[]) => {
    const existingKeys = new Set(staged.map((item) => item.dedupeKey).filter((key): key is string => !!key));
    const remaining = MAX_MY_ITEMS - staged.length;
    const fresh: StagedMedia[] = [];
    let hadDuplicate = false;
    let hadOverflow = false;

    for (const asset of assets) {
      const key = mediaKey(asset);
      if (existingKeys.has(key)) {
        hadDuplicate = true;
        continue;
      }
      if (fresh.length >= remaining) {
        hadOverflow = true;
        continue;
      }
      existingKeys.add(key);
      const kind: MediaKind = asset.type === 'video' ? 'video' : 'photo';
      fresh.push({
        id: `${Date.now()}-${fresh.length}-${Math.random().toString(36).slice(2, 7)}`,
        kind,
        imageUrl: kind === 'photo' ? asset.uri : undefined,
        durationLabel: kind === 'video' && asset.duration ? formatDuration(asset.duration) : undefined,
        dedupeKey: key,
      });
    }

    if (fresh.length > 0) setStaged((prev) => [...prev, ...fresh]);
    if (hadOverflow) toast.show(MAX_ITEMS_MESSAGE);
    else if (hadDuplicate) toast.show('이미 추가한 파일은 다시 담지 않았어요');
  };

  const handlePick = async (action: MediaPickerAction) => {
    setPickerVisible(false);

    if (staged.length >= MAX_MY_ITEMS) {
      toast.show(MAX_ITEMS_MESSAGE);
      return;
    }

    try {
      if (action === 'library-photo' || action === 'library-video') {
        const remaining = MAX_MY_ITEMS - staged.length;
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: action === 'library-photo' ? ['images'] : ['videos'],
          allowsMultipleSelection: true,
          selectionLimit: remaining,
          orderedSelection: true,
          quality: 0.8,
        });
        if (result.canceled || result.assets.length === 0) return;
        appendAssets(result.assets);
        return;
      }

      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        toast.show('카메라 권한이 필요해요');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: action === 'camera-photo' ? ['images'] : ['videos'],
        quality: 0.8,
        cameraType: ImagePicker.CameraType.back,
      });
      if (result.canceled || result.assets.length === 0) return;
      appendAssets(result.assets);
    } catch {
      toast.show('불러오지 못했어요');
    }
  };

  const removeStaged = (id: string) => setStaged((prev) => prev.filter((item) => item.id !== id));

  const upload = async () => {
    if (staged.length === 0) return;
    if (IS_DEMO_BUILD) {
      // 데모: 업로드는 팀원 구현 영역이다. 연결 지점(uploadBridge)을 부르고, 처리되지 않으면
      // 올린 것처럼 꾸미지 않고 안내만 한다(고른 항목은 그대로 둔다).
      try {
        const result = await requestUpload({
          tripId,
          itineraryId: itinerary.id,
          dayId: day.id,
          visitId: visitIdOf(itinerary.id, day.id, place ?? { id: placeId }),
          placeId,
          placeName: place?.name ?? '',
        });
        if (!result.handled) {
          setUploadNotice(UPLOAD_NOT_CONNECTED_MESSAGE);
          return;
        }
        toast.show(`${staged.length}개를 업로드 기능으로 넘겼어요`);
        setStaged([]);
        setUploadVisible(false);
      } catch {
        setUploadNotice('업로드를 시작하지 못했어요');
      }
      return;
    }
    // 프로토타입: 실제 저장 없이 완료 안내만 하고 선택을 비운다(기록 목록은 mock 이라 그대로다).
    toast.show(`${staged.length}개 업로드 완료! (프로토타입은 여기까지예요)`);
    setStaged([]);
    setUploadVisible(false);
  };

  /**
   * "사진·동영상 올리기": 촬영·선택·업로드는 팀원 구현 영역이다.
   * 데모 빌드에서는 연결 지점(uploadBridge)만 호출하고, 핸들러가 없으면 안내만 한다(올린 것처럼 꾸미지 않는다).
   */
  const handleUploadPress = () => setUploadVisible(true);

  /** 사진별 보기의 "선택" 모드와 선택한 사진 id */
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  /** 사람별 보기 ⋯ 메뉴가 열린 스팟원 id */
  const [menuMemberId, setMenuMemberId] = useState<string | null>(null);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const exitSelecting = () => {
    setSelecting(false);
    setSelectedIds([]);
  };
  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  const allSelected = cards.length > 0 && selectedIds.length === cards.length;

  /** 고른 카드들을 다운로드 연결 지점으로 넘긴다. 처리되지 않으면 저장된 척하지 않고 안내만 한다. */
  const downloadCards = async (target: FlatMediaCard[]) => {
    if (target.length === 0) return;
    try {
      const result = await requestDownload(
        target.map((c) => ({ id: c.item.id, kind: c.item.kind === 'video' ? 'video' : 'photo', source: c.item.imageUrl as string | number })),
      );
      if (!result.handled) {
        setDownloadNotice(DOWNLOAD_NOT_CONNECTED_MESSAGE);
        return;
      }
      toast.show(`${target.length}개를 저장했어요`);
      exitSelecting();
    } catch {
      setDownloadNotice('저장하지 못했어요');
    }
  };

  const openViewer = (card: FlatMediaCard) => {
    // 재생할 영상 파일이 없는 동영상은 열지 않는다(사진처럼 보여 주며 동영상인 척하지 않는다).
    if (card.item.kind === 'video' && card.item.videoSource === undefined) {
      toast.show('재생은 아직 지원하지 않아요');
      return;
    }
    setViewerTarget({ item: card.item, author: card.member.name, time: card.postTime });
  };

  return (
    <ScreenFrame>
      <AppHeader
        title={place?.name ?? '장소'}
        subtitle={`${itinerary.name} · ${shortDotDateLabel(day.date)} ${dayOfWeekLabel(day.date)}`}
        onBack={nav.back}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="사진·동영상 올리기"
          onPress={handleUploadPress}
          style={({ pressed }) => [styles.uploadButton, pressed && styles.pressed]}
        >
          <Text style={styles.uploadButtonText}>＋ 사진·동영상 올리기</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>{listTitle}</Text>

        {cards.length > 0 ? (
          <View style={styles.segmentRow}>
            <View style={styles.segment} accessibilityRole="tablist">
              {([['photo', '사진별'], ['person', '사람별']] as const).map(([mode, label]) => (
                <Pressable
                  key={mode}
                  accessibilityRole="tab"
                  accessibilityLabel={`${label} 보기`}
                  accessibilityState={{ selected: viewMode === mode }}
                  onPress={() => {
                    setViewMode(mode);
                    exitSelecting();
                  }}
                  style={[styles.segmentItem, viewMode === mode && styles.segmentItemActive]}
                >
                  {mode === 'photo' ? (
                    <PhotoGridIcon size={17} color={viewMode === mode ? colors.text : colors.textMuted} />
                  ) : (
                    <PersonIcon size={17} color={viewMode === mode ? colors.text : colors.textMuted} />
                  )}
                </Pressable>
              ))}
            </View>
            {selecting ? (
              <View style={styles.selectActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={allSelected ? '전체 선택 해제' : '전체 선택'}
                  onPress={() => setSelectedIds(allSelected ? [] : cards.map((c) => c.item.id))}
                  hitSlop={6}
                >
                  <Text style={styles.selectText}>{allSelected ? '전체 해제' : '전체 선택'}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="선택 취소" onPress={exitSelecting} hitSlop={6}>
                  <Text style={styles.selectText}>취소</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.selectActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={newestFirst ? '정렬: 최신순, 누르면 오래된순' : '정렬: 오래된순, 누르면 최신순'}
                  onPress={() => setNewestFirst((v) => !v)}
                  hitSlop={6}
                >
                  <Text style={styles.selectText}>{newestFirst ? '최신순' : '오래된순'}</Text>
                </Pressable>
                {viewMode === 'photo' ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="사진 선택" onPress={() => setSelecting(true)} hitSlop={6}>
                    <Text style={styles.selectText}>선택</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
        ) : null}

        {cards.length === 0 ? (
          <Text style={styles.emptyCards}>아직 이곳에 남긴 사진·동영상이 없어요.{'\n'}스팟원이 올리면 여기에 모여요.</Text>
        ) : viewMode === 'person' ? (
          groups.map((group) => {
            const photos = group.cards.filter((c) => c.item.kind !== 'video').length;
            const videos = group.cards.length - photos;
            const expanded = expandedIds.includes(group.member.id);
            return (
              <View key={group.member.id} style={styles.personCard}>
                <View style={styles.personHead}>
                  <Avatar uri={group.member.avatarUrl} size={36} />
                  <View style={styles.personHeadText}>
                    <Text style={styles.personName}>{group.member.name}</Text>
                    <Text style={styles.personSub}>
                      {`사진 ${photos}${videos > 0 ? ` · 동영상 ${videos}` : ''} · ${group.firstTime.replace(/^\d{1,2}\.\d{1,2}\s+/, '')}`}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${group.member.name} 더보기 메뉴`}
                    onPress={() => setMenuMemberId(group.member.id)}
                    hitSlop={10}
                    style={styles.moreButton}
                  >
                    <Text style={styles.moreGlyph}>⋯</Text>
                  </Pressable>
                </View>
                <PersonGrid
                  cards={group.cards}
                  width={gridWidth - PERSON_PAD * 2}
                  expanded={expanded}
                  onOpen={openViewer}
                  onExpand={() => setExpandedIds((prev) => [...prev, group.member.id])}
                />
                {expanded && group.cards.length > GROUP_PREVIEW ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${group.member.name} 사진 접기`}
                    onPress={() => setExpandedIds((prev) => prev.filter((id) => id !== group.member.id))}
                    hitSlop={6}
                  >
                    <Text style={styles.collapseText}>접기 ⌃</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        ) : (
          cards.map((card, index) => (
            <Pressable
              key={card.item.id}
              accessibilityRole="button"
              accessibilityLabel={`${card.member.name}이 올린 ${card.item.kind === 'video' ? '동영상 재생' : '사진 크게 보기'}`}
              onPress={() => (selecting ? toggleSelected(card.item.id) : openViewer(card))}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              {selecting ? (
                <View style={[styles.checkCircle, selectedIds.includes(card.item.id) && styles.checkCircleOn]}>
                  {selectedIds.includes(card.item.id) ? <Text style={styles.checkGlyph}>✓</Text> : null}
                </View>
              ) : null}
              {card.item.imageUrl ? (
                <SafeImage source={card.item.imageUrl} style={[styles.cardImage, { height: cardImageHeight }]} resizeMode="cover" />
              ) : (
                <View style={[styles.cardImage, styles.cardImageBlank, { height: cardImageHeight }]} />
              )}

              {card.item.kind === 'video' ? (
                <View style={styles.playOverlay}>
                  <Text style={styles.playGlyph}>▶</Text>
                  {card.item.durationLabel ? <Text style={styles.playDuration}>{card.item.durationLabel}</Text> : null}
                </View>
              ) : null}

              <View style={styles.cardFooterGradient}>
                <View style={styles.cardFooterBand1} />
                <View style={styles.cardFooterBand2} />
                <View style={styles.cardFooterBand3} />
              </View>
              <View style={styles.cardFooter}>
                <Avatar uri={card.member.avatarUrl} size={28} />
                <View style={styles.cardFooterText}>
                  <Text style={styles.cardFooterTop}>
                    {/* 날짜는 화면 상단 부제목에 이미 있어 카드에는 시간만 보여 준다 */}
                    {card.postTime.replace(/^\d{1,2}\.\d{1,2}\s+/, '')} · {card.member.name}
                  </Text>
                  {card.item.caption ? (
                    <Text style={styles.cardCaption} numberOfLines={1}>
                      {card.item.caption}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      {/* 사진별 선택 모드: 고른 개수만큼 다운받기 */}
      {selecting ? (
        <View style={styles.selectBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: selectedIds.length === 0 }}
            disabled={selectedIds.length === 0}
            onPress={() => downloadCards(cards.filter((c) => selectedIds.includes(c.item.id)))}
            style={[styles.uploadBtn, selectedIds.length > 0 ? styles.uploadBtnActive : styles.uploadBtnDisabled]}
          >
            <Text style={[styles.uploadBtnText, selectedIds.length > 0 ? styles.uploadBtnTextActive : styles.uploadBtnTextDisabled]}>
              {selectedIds.length > 0 ? `${selectedIds.length}개 다운받기` : '사진을 선택하세요'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* 사람별 ⋯ 메뉴 */}
      <Modal visible={menuMemberId !== null} animationType="fade" transparent onRequestClose={() => setMenuMemberId(null)}>
        <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={() => setMenuMemberId(null)} style={styles.backdrop} />
        <View style={styles.uploadSheet}>
          <View style={styles.handle} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="사진 다운받기"
            onPress={() => {
              const target = groups.find((g) => g.member.id === menuMemberId);
              setMenuMemberId(null);
              if (target) downloadCards(target.cards);
            }}
            style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
          >
            <Text style={styles.menuItemText}>사진 다운받기</Text>
          </Pressable>
        </View>
      </Modal>

      <NoticeModal
        visible={downloadNotice !== null}
        title="사진 다운받기"
        message={downloadNotice ?? ''}
        onConfirm={() => setDownloadNotice(null)}
      />

      {/* 업로드 시트: 버튼을 눌렀을 때만 연다. 선택·중복 거르기·업로드 로직은 기존 그대로다. */}
      <Modal visible={uploadVisible} animationType="slide" transparent onRequestClose={() => setUploadVisible(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={() => setUploadVisible(false)} style={styles.backdrop} />
        <View style={styles.uploadSheet}>
          <View style={styles.handle} />
          <Text style={styles.uploadSheetTitle}>지금 이 순간 남기기</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stageRow}>
            {staged.map((item) => (
              <StagedMediaThumb key={item.id} item={item} size={STAGE_TILE_SIZE} onRemove={() => removeStaged(item.id)} />
            ))}
            {staged.length < MAX_MY_ITEMS && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="사진·동영상 추가"
                onPress={() => setPickerVisible(true)}
                style={({ pressed }) => [styles.addTile, { width: STAGE_TILE_SIZE, height: STAGE_TILE_SIZE }, pressed && styles.pressed]}
              >
                <Text style={styles.addPlus}>＋</Text>
              </Pressable>
            )}
          </ScrollView>

          <Text style={styles.stageCaption}>사진·동영상 최대 {MAX_MY_ITEMS}개</Text>

          <UploadCommitButton active={staged.length > 0} onPress={upload} />
        </View>
      </Modal>

      <MediaPickerSheet visible={pickerVisible} onSelect={handlePick} onCancel={() => setPickerVisible(false)} />

      <NoticeModal
        visible={uploadNotice !== null}
        title="사진·동영상 올리기"
        message={uploadNotice ?? ''}
        onConfirm={() => setUploadNotice(null)}
      />

      {/* 사진 확대 보기 · 동영상 재생 */}
      <MediaViewerModal target={viewerTarget} onClose={() => setViewerTarget(null)} />

      <Toast message={toast.message} bottom={24} />
    </ScreenFrame>
  );
}

/** 사람별 보기 카드 안쪽 여백(px). */
const PERSON_PAD = 12;

/**
 * 한 스팟원의 사진·동영상을 격자로 보여 준다.
 * 1장은 크게, 2장은 나란히, 3장은 위 1 + 아래 2, 4장 이상은 2x2(5장 이상이면 네 번째 칸에 +N).
 * +N 을 누르면 모두 펼친다. 각 칸은 원래 사진을 그대로 열어 보는 눌림 영역이다.
 */
function PersonGrid({
  cards,
  width,
  expanded,
  onOpen,
  onExpand,
}: {
  cards: FlatMediaCard[];
  width: number;
  expanded: boolean;
  onOpen: (card: FlatMediaCard) => void;
  onExpand: () => void;
}) {
  const half = Math.floor((width - GRID_GAP) / 2);
  const shown = expanded ? cards : cards.slice(0, GROUP_PREVIEW);
  const extra = expanded ? 0 : Math.max(0, cards.length - GROUP_PREVIEW);

  const tile = (card: FlatMediaCard, w: number, h: number, more = 0) => (
    <Pressable
      key={card.item.id}
      accessibilityRole="button"
      accessibilityLabel={
        more > 0
          ? `${card.member.name} 사진 ${more}개 더 보기`
          : `${card.member.name}이 올린 ${card.item.kind === 'video' ? '동영상 재생' : '사진 크게 보기'}`
      }
      onPress={() => (more > 0 ? onExpand() : onOpen(card))}
      style={({ pressed }) => [{ width: w, height: h }, styles.tile, pressed && styles.pressed]}
    >
      {card.item.imageUrl ? (
        <SafeImage source={card.item.imageUrl} style={styles.tileImage} resizeMode="cover" />
      ) : (
        <View style={styles.tileImage} />
      )}
      {card.item.kind === 'video' ? (
        <View style={styles.tileVideoBadge}>
          <Text style={styles.playGlyph}>▶</Text>
          {card.item.durationLabel ? <Text style={styles.playDuration}>{card.item.durationLabel}</Text> : null}
        </View>
      ) : null}
      {more > 0 ? (
        <View style={styles.tileMore}>
          <Text style={styles.tileMoreText}>+{more}</Text>
        </View>
      ) : null}
    </Pressable>
  );

  if (!expanded && shown.length === 1) return <View>{tile(shown[0], width, Math.round((width * 3) / 4))}</View>;
  if (!expanded && shown.length === 3) {
    return (
      <View style={{ gap: GRID_GAP }}>
        {tile(shown[0], width, Math.round(width / 2))}
        <View style={styles.tileRow}>
          {tile(shown[1], half, half)}
          {tile(shown[2], half, half)}
        </View>
      </View>
    );
  }
  // 2장, 4장 이상(펼친 경우 포함): 정사각형 두 칸씩 줄바꿈
  return (
    <View style={styles.tileWrap}>
      {shown.map((card, i) => tile(card, half, half, extra > 0 && i === shown.length - 1 ? extra + 1 : 0))}
    </View>
  );
}

function UploadCommitButton({ active, onPress }: { active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !active }}
      disabled={!active}
      onPress={onPress}
      style={({ pressed }) => [
        styles.uploadBtn,
        active ? styles.uploadBtnActive : styles.uploadBtnDisabled,
        active && pressed && styles.uploadBtnPressed,
      ]}
    >
      <Text style={[styles.uploadBtnText, active ? styles.uploadBtnTextActive : styles.uploadBtnTextDisabled]}>업로드하기</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 32, gap: 14 },

  uploadButton: {
    minHeight: MIN_TOUCH - 8,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButtonText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  pressed: { opacity: 0.85 },

  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  emptyCards: { fontSize: 13, color: colors.textMuted, paddingVertical: 20, textAlign: 'center' },

  segmentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectActions: { flexDirection: 'row', gap: 16 },
  selectText: { fontSize: 13, fontWeight: '700', color: colors.textSub },
  moreButton: { paddingHorizontal: 6, minHeight: 32, justifyContent: 'center' },
  moreGlyph: { fontSize: 22, fontWeight: '800', color: colors.textSub, lineHeight: 24 },
  checkCircle: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleOn: { backgroundColor: colors.primary },
  checkGlyph: { color: '#fff', fontSize: 14, fontWeight: '800' },
  selectBar: { paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 16, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line },
  menuItem: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  menuItemText: { fontSize: 16, fontWeight: '700', color: colors.text },

  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 2,
    alignSelf: 'flex-start',
  },
  segmentItem: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentItemActive: { backgroundColor: colors.bg, boxShadow: '0px 1px 4px rgba(25, 31, 40, 0.12)' },

  personCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.card,
    padding: PERSON_PAD,
    gap: 10,
    boxShadow: CARD_SHADOW,
  },
  personHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personHeadText: { flex: 1, gap: 1 },
  personName: { fontSize: 15, fontWeight: '800', color: colors.text },
  personSub: { fontSize: 12, color: colors.textMuted },
  collapseText: { fontSize: 13, fontWeight: '700', color: colors.textSub, textAlign: 'center', paddingVertical: 2 },
  tile: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surfaceStrong },
  tileImage: { width: '100%', height: '100%', backgroundColor: colors.surfaceStrong },
  tileRow: { flexDirection: 'row', gap: GRID_GAP },
  tileWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  tileVideoBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tileMore: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileMoreText: { color: '#fff', fontSize: 26, fontWeight: '800' },

  card: {
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.surfaceStrong,
    boxShadow: CARD_SHADOW,
  },
  cardImage: { width: '100%' },
  cardImageBlank: { backgroundColor: colors.surfaceStrong },
  playOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  playGlyph: { color: '#fff', fontSize: 11 },
  playDuration: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardFooterGradient: {
    // 별도 그라데이션 라이브러리 없이, 아래로 갈수록 진해지는 반투명 흰 띠 3개를 겹쳐 그라데이션처럼 보이게 한다.
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '46%',
  },
  cardFooterBand1: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, backgroundColor: 'rgba(255,255,255,0.12)' },
  cardFooterBand2: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '40%', backgroundColor: 'rgba(255,255,255,0.35)' },
  cardFooterBand3: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '68%', backgroundColor: 'rgba(255,255,255,0.78)' },
  cardFooter: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardFooterText: { flex: 1, gap: 1 },
  cardFooterTop: { fontSize: 12, fontWeight: '800', color: colors.text },
  cardCaption: { fontSize: 12, color: colors.textSub },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  uploadSheet: {
    backgroundColor: colors.bg,
    width: '100%', maxWidth: 430, alignSelf: 'center', borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 10,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 2 },
  uploadSheetTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  stageRow: { gap: 10, paddingVertical: 2 },
  addTile: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlus: { fontSize: 22, color: colors.primary, fontWeight: '700' },
  stageCaption: { fontSize: 12, color: colors.textMuted },

  uploadBtn: { minHeight: MIN_TOUCH, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  uploadBtnDisabled: { backgroundColor: colors.primarySoft },
  uploadBtnActive: { backgroundColor: colors.primary },
  uploadBtnPressed: { backgroundColor: colors.primaryPressed },
  uploadBtnText: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  uploadBtnTextDisabled: { color: colors.primary },
  uploadBtnTextActive: { color: colors.onPrimary },

  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(10,10,12,0.92)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  viewerImage: { width: '100%', height: '78%' },
  viewerCaption: { position: 'absolute', left: 20, right: 20, bottom: 28, gap: 2 },
  viewerCaptionText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  viewerCaptionSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
});
